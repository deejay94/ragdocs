import { sql } from "drizzle-orm";
import { connection, NextResponse } from "next/server";

import { db } from "@/lib/db";

/**
 * Liveness probe for the app and database connectivity.
 * Does not exercise OpenAI or the RAG pipeline.
 */
export async function GET() {
  // Defer to request time under Next.js Cache Components.
  await connection();

  const checkedAt = new Date().toISOString();

  try {
    await db.execute(sql`select 1`);

    return NextResponse.json({
      ok: true,
      service: "ragdocs",
      database: "up",
      checkedAt,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown database error";

    return NextResponse.json(
      {
        ok: false,
        service: "ragdocs",
        database: "down",
        error: message,
        checkedAt,
      },
      { status: 503 },
    );
  }
}
