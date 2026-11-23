import { connection, NextResponse } from "next/server";
import { z } from "zod";

import {
  deleteDocument,
  getDocumentWithChunks,
} from "@/lib/documents/ingest";
import { mapErrorToPublic } from "@/lib/http/errors";

const idSchema = z.string().uuid();

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  await connection();

  const { id } = await context.params;
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json(
      { error: "Invalid document id.", code: "bad_request" },
      { status: 400 },
    );
  }

  try {
    const result = await getDocumentWithChunks(parsedId.data);
    if (!result) {
      return NextResponse.json(
        { error: "Document not found.", code: "not_found" },
        { status: 404 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    const mapped = mapErrorToPublic(error, "Failed to load document.");
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  await connection();

  const { id } = await context.params;
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json(
      { error: "Invalid document id.", code: "bad_request" },
      { status: 400 },
    );
  }

  try {
    const deleted = await deleteDocument(parsedId.data);
    if (!deleted) {
      return NextResponse.json(
        { error: "Document not found.", code: "not_found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const mapped = mapErrorToPublic(error, "Failed to delete document.");
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
