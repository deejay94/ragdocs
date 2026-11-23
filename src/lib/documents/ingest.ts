import { eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { db } from "@/lib/db";
import { chunks, documents, type Document } from "@/lib/db/schema";
import { chunkText } from "@/lib/rag/chunk";
import { embedTexts } from "@/lib/rag/embed";

import { MAX_UPLOAD_BYTES } from "./constants";
import {
  isAllowedUploadFilename,
  mimeTypeForExtension,
  parseDocumentBytes,
} from "./parse";
import { deleteUploadDir, saveUpload } from "./storage";

export type IngestResult = {
  document: Document;
  chunkCount: number;
};

async function markFailed(documentId: string, error: unknown) {
  const message =
    error instanceof Error ? error.message : "Unknown ingestion error";

  await db
    .update(documents)
    .set({
      status: "failed",
      errorMessage: message,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, documentId));
}

/**
 * Full ingest pipeline: validate → store file → parse → chunk → embed → index.
 * Failures move the document to `failed` and leave no orphan chunks.
 */
export async function ingestUploadedFile(params: {
  filename: string;
  bytes: Buffer;
}): Promise<IngestResult> {
  if (!isAllowedUploadFilename(params.filename)) {
    throw new Error("Only .md and .txt files are supported.");
  }

  if (params.bytes.byteLength === 0) {
    throw new Error("Uploaded file is empty.");
  }

  if (params.bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error(
      `File exceeds the ${MAX_UPLOAD_BYTES} byte upload limit (${params.bytes.byteLength} bytes).`,
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === "sk-your-key-here") {
    throw new Error(
      "OPENAI_API_KEY is not configured. Set a real key in .env.local to ingest documents.",
    );
  }

  const parsed = parseDocumentBytes(params.filename, params.bytes);
  const documentId = randomUUID();

  const stored = await saveUpload({
    documentId,
    originalFilename: params.filename,
    bytes: params.bytes,
  });

  await db.insert(documents).values({
    id: documentId,
    title: parsed.title,
    sourcePath: stored.relativePath,
    mimeType: mimeTypeForExtension(parsed.extension),
    byteSize: params.bytes.byteLength,
    status: "processing",
  });

  try {
    const textChunks = chunkText(parsed.text);
    if (textChunks.length === 0) {
      throw new Error("No indexable text chunks were produced from the file.");
    }

    const embeddings = await embedTexts(textChunks.map((chunk) => chunk.content));

    await db.insert(chunks).values(
      textChunks.map((chunk, index) => ({
        documentId,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        headingPath: chunk.headingPath,
        tokenEstimate: chunk.tokenEstimate,
        embedding: embeddings[index],
      })),
    );

    const [ready] = await db
      .update(documents)
      .set({
        status: "ready",
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, documentId))
      .returning();

    return { document: ready, chunkCount: textChunks.length };
  } catch (error) {
    await db.delete(chunks).where(eq(chunks.documentId, documentId));
    await markFailed(documentId, error);
    throw error;
  }
}

export async function listDocuments() {
  const rows = await db
    .select({
      id: documents.id,
      title: documents.title,
      status: documents.status,
      mimeType: documents.mimeType,
      byteSize: documents.byteSize,
      errorMessage: documents.errorMessage,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
      chunkCount: sql<number>`cast(count(${chunks.id}) as int)`,
    })
    .from(documents)
    .leftJoin(chunks, eq(chunks.documentId, documents.id))
    .groupBy(documents.id)
    .orderBy(sql`${documents.createdAt} desc`);

  return rows;
}

export async function getDocumentWithChunks(documentId: string) {
  const document = await db.query.documents.findFirst({
    where: eq(documents.id, documentId),
  });

  if (!document) {
    return null;
  }

  const documentChunks = await db
    .select({
      id: chunks.id,
      chunkIndex: chunks.chunkIndex,
      content: chunks.content,
      headingPath: chunks.headingPath,
      tokenEstimate: chunks.tokenEstimate,
      createdAt: chunks.createdAt,
    })
    .from(chunks)
    .where(eq(chunks.documentId, documentId))
    .orderBy(chunks.chunkIndex);

  return { document, chunks: documentChunks };
}

export async function deleteDocument(documentId: string): Promise<boolean> {
  const existing = await db.query.documents.findFirst({
    where: eq(documents.id, documentId),
  });

  if (!existing) {
    return false;
  }

  await db.delete(documents).where(eq(documents.id, documentId));
  await deleteUploadDir(documentId);
  return true;
}
