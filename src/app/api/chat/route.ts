import { connection } from "next/server";
import { z } from "zod";

import { answerQuestion } from "@/lib/chat/answer";
import type { ChatStreamEvent } from "@/lib/chat/types";

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

  let parsed: z.infer<typeof chatBodySchema>;

  try {
    const json: unknown = await request.json();
    const result = chatBodySchema.safeParse(json);
    if (!result.success) {
      return Response.json(
        {
          error: "Invalid request body.",
          details: result.error.flatten(),
        },
        { status: 400 },
      );
    }
    parsed = result.data;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
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
          push(event);
          if (event.type === "error") {
            break;
          }
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to answer question";
        push({ type: "error", error: message });
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
    },
  });
}
