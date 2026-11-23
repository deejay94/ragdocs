import { asc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { conversations, messages } from "@/lib/db/schema";
import type { Citation } from "@/lib/chat/types";

export async function createConversation() {
  const [row] = await db.insert(conversations).values({}).returning();
  if (!row) {
    throw new Error("Failed to create conversation.");
  }
  return row;
}

export async function getConversation(id: string) {
  const [row] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id))
    .limit(1);
  return row ?? null;
}

export async function addMessage(options: {
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations?: Citation[] | null;
}) {
  const [row] = await db
    .insert(messages)
    .values({
      conversationId: options.conversationId,
      role: options.role,
      content: options.content,
      citationsJson: options.citations ?? null,
    })
    .returning();

  if (!row) {
    throw new Error("Failed to store message.");
  }

  return row;
}

export async function listMessages(conversationId: string) {
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt));
}
