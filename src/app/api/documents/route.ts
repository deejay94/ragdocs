import { connection, NextResponse } from "next/server";

import { ingestUploadedFile, listDocuments } from "@/lib/documents/ingest";
import { MAX_UPLOAD_BYTES } from "@/lib/documents/constants";

export async function GET() {
  await connection();

  try {
    const documents = await listDocuments();
    return NextResponse.json({ documents });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list documents";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  await connection();

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'Expected multipart field "file".' },
        { status: 400 },
      );
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        {
          error: `File exceeds the ${MAX_UPLOAD_BYTES} byte upload limit.`,
        },
        { status: 400 },
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const result = await ingestUploadedFile({
      filename: file.name,
      bytes,
    });

    return NextResponse.json(
      {
        document: result.document,
        chunkCount: result.chunkCount,
      },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to ingest document";
    const status =
      message.includes("Only .md") ||
      message.includes("empty") ||
      message.includes("Unsupported") ||
      message.includes("upload limit")
        ? 400
        : message.includes("OPENAI_API_KEY")
          ? 503
          : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
