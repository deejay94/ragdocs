import path from "node:path";

import { ALLOWED_EXTENSIONS } from "./constants";

export type ParsedDocument = {
  title: string;
  text: string;
  extension: (typeof ALLOWED_EXTENSIONS)[number];
};

function extensionOf(filename: string): string {
  return path.extname(filename).toLowerCase();
}

export function isAllowedUploadFilename(filename: string): boolean {
  const ext = extensionOf(filename);
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(ext);
}

/**
 * Decode UTF-8 bytes and derive a display title from the first H1 or filename.
 */
export function parseDocumentBytes(
  filename: string,
  bytes: Buffer,
): ParsedDocument {
  const extension = extensionOf(filename);
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(extension)) {
    throw new Error(
      `Unsupported file type "${extension}". Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`,
    );
  }

  const text = bytes.toString("utf8").replace(/^\uFEFF/, "");
  if (!text.trim()) {
    throw new Error("Uploaded file is empty.");
  }

  const h1 = text.match(/^#\s+(.+)$/m);
  const fromName = path.basename(filename, extension);
  const title = (h1?.[1] ?? fromName).trim() || "Untitled document";

  return {
    title,
    text,
    extension: extension as ParsedDocument["extension"],
  };
}

export function mimeTypeForExtension(
  extension: ParsedDocument["extension"],
): string {
  return extension === ".md" ? "text/markdown" : "text/plain";
}
