import { connection, NextResponse } from "next/server";

import { ingestUploadedFile, listDocuments } from "@/lib/documents/ingest";
import { MAX_UPLOAD_BYTES } from "@/lib/documents/constants";
import { mapErrorToPublic } from "@/lib/http/errors";
import {
  assertUploadContentLength,
  RequestTooLargeError,
} from "@/lib/http/request";
import { getRateLimitDocumentsWritePerMin } from "@/lib/security/constants";
import {
  checkRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";

export async function GET() {
  await connection();

  try {
    const documents = await listDocuments();
    return NextResponse.json({ documents });
  } catch (error) {
    const mapped = mapErrorToPublic(error, "Failed to list documents.");
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

export async function POST(request: Request) {
  await connection();

  const limit = getRateLimitDocumentsWritePerMin();
  const ip = getClientIp(request);
  const rate = checkRateLimit(`documents-write:${ip}`, limit);

  if (!rate.ok) {
    return NextResponse.json(
      {
        error: "Too many upload requests. Try again shortly.",
        code: "rate_limited",
      },
      { status: 429, headers: rateLimitHeaders(rate, limit) },
    );
  }

  try {
    assertUploadContentLength(request, MAX_UPLOAD_BYTES);

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          error: 'Expected multipart field "file".',
          code: "bad_request",
        },
        { status: 400, headers: rateLimitHeaders(rate, limit) },
      );
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        {
          error: `File exceeds the ${MAX_UPLOAD_BYTES} byte upload limit.`,
          code: "payload_too_large",
        },
        { status: 413, headers: rateLimitHeaders(rate, limit) },
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
      { status: 201, headers: rateLimitHeaders(rate, limit) },
    );
  } catch (error) {
    if (error instanceof RequestTooLargeError) {
      return NextResponse.json(
        {
          error: "Upload is too large.",
          code: "payload_too_large",
        },
        { status: 413, headers: rateLimitHeaders(rate, limit) },
      );
    }

    const mapped = mapErrorToPublic(error, "Failed to ingest document.");
    return NextResponse.json(mapped.body, {
      status: mapped.status,
      headers: rateLimitHeaders(rate, limit),
    });
  }
}
