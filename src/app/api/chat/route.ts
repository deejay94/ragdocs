import { connection } from "next/server";
import { z } from "zod";

import { answerQuestion } from "@/lib/chat/answer";
import type { ChatStreamEvent } from "@/lib/chat/types";
import { publicErrorMessage } from "@/lib/http/errors";
import { readJsonBody, RequestTooLargeError } from "@/lib/http/request";
import { getRateLimitChatPerMin } from "@/lib/security/constants";
import {
  checkRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";

const chatBodySchema = z.object({
  query: z.string().trim().min(1, "Query must not be empty.").max(4000),
  conversationId: z.string().uuid().optional(),
  documentId: z.string().uuid().optional(),
});

function encodeSse(event: ChatStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(request: Request) {
  await connection();

  const limit = getRateLimitChatPerMin();
  const ip = getClientIp(request);
  const rate = checkRateLimit(`chat:${ip}`, limit);

  if (!rate.ok) {
    return Response.json(
      {
        error: "Too many chat requests. Try again shortly.",
        code: "rate_limited",
      },
      { status: 429, headers: rateLimitHeaders(rate, limit) },
    );
  }

  let parsed: z.infer<typeof chatBodySchema>;

  try {
    const json = await readJsonBody(request);
    const result = chatBodySchema.safeParse(json);
    if (!result.success) {
      return Response.json(
        {
          error: "Invalid request body.",
          code: "bad_request",
        },
        { status: 400, headers: rateLimitHeaders(rate, limit) },
      );
    }
    parsed = result.data;
  } catch (error) {
    if (error instanceof RequestTooLargeError) {
      return Response.json(
        {
          error: "Request body is too large.",
          code: "payload_too_large",
        },
        { status: 413, headers: rateLimitHeaders(rate, limit) },
      );
    }

    return Response.json(
      {
        error: "Invalid JSON body.",
        code: "bad_request",
      },
      { status: 400, headers: rateLimitHeaders(rate, limit) },
    );
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();

      const push = (event: ChatStreamEvent) => {
        controller.enqueue(encoder.encode(encodeSse(event)));
      };

      try {
        for await (const event of answerQuestion({
          query: parsed.query,
          conversationId: parsed.conversationId,
          documentId: parsed.documentId,
        })) {
          if (event.type === "error") {
            push({
              type: "error",
              error: publicErrorMessage(
                new Error(event.error),
                "Failed to answer question.",
              ),
            });
            break;
          }
          push(event);
        }
      } catch (error) {
        push({
          type: "error",
          error: publicErrorMessage(error, "Failed to answer question."),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      ...rateLimitHeaders(rate, limit),
    },
  });
}
