import { MAX_JSON_BODY_BYTES } from "@/lib/security/constants";

export class RequestTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`Request body exceeds the ${maxBytes} byte limit.`);
    this.name = "RequestTooLargeError";
  }
}

/**
 * Read JSON after enforcing Content-Length (when present) and a hard byte cap.
 */
export async function readJsonBody(
  request: Request,
  maxBytes: number = MAX_JSON_BODY_BYTES,
): Promise<unknown> {
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const length = Number.parseInt(contentLength, 10);
    if (Number.isFinite(length) && length > maxBytes) {
      throw new RequestTooLargeError(maxBytes);
    }
  }

  const buffer = Buffer.from(await request.arrayBuffer());
  if (buffer.byteLength > maxBytes) {
    throw new RequestTooLargeError(maxBytes);
  }

  if (buffer.byteLength === 0) {
    throw new SyntaxError("Empty JSON body.");
  }

  return JSON.parse(buffer.toString("utf8")) as unknown;
}

export function assertUploadContentLength(
  request: Request,
  maxBytes: number,
): void {
  const contentLength = request.headers.get("content-length");
  if (!contentLength) return;

  const length = Number.parseInt(contentLength, 10);
  // Multipart overhead means Content-Length can exceed the file size slightly;
  // still reject obviously oversized envelopes (file + ~1 MB padding).
  if (Number.isFinite(length) && length > maxBytes + 1024 * 1024) {
    throw new RequestTooLargeError(maxBytes);
  }
}
