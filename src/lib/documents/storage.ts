import { promises as fs } from "node:fs";
import path from "node:path";

const UPLOADS_ROOT = path.join(process.cwd(), "uploads");

function sanitizeFilename(filename: string): string {
  const base = path.basename(filename).replace(/[^a-zA-Z0-9._-]+/g, "_");
  return base.length > 0 ? base.slice(0, 180) : "document.txt";
}

export function uploadsRoot(): string {
  return UPLOADS_ROOT;
}

export function documentDir(documentId: string): string {
  return path.join(UPLOADS_ROOT, documentId);
}

export async function saveUpload(params: {
  documentId: string;
  originalFilename: string;
  bytes: Buffer;
}): Promise<{ absolutePath: string; relativePath: string; storedName: string }> {
  const storedName = sanitizeFilename(params.originalFilename);
  const dir = documentDir(params.documentId);
  await fs.mkdir(dir, { recursive: true });

  const absolutePath = path.join(dir, storedName);
  await fs.writeFile(absolutePath, params.bytes);

  const relativePath = path.posix.join("uploads", params.documentId, storedName);
  return { absolutePath, relativePath, storedName };
}

export async function deleteUploadDir(documentId: string): Promise<void> {
  await fs.rm(documentDir(documentId), { recursive: true, force: true });
}
