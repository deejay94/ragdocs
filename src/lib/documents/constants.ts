/** Allowed documentation uploads for Milestone 3. */
export const ALLOWED_EXTENSIONS = [".md", ".txt"] as const;

export const ALLOWED_MIME_TYPES = [
  "text/markdown",
  "text/plain",
  "text/x-markdown",
  "application/octet-stream",
] as const;

/** 2 MB upload ceiling (plan security baseline). */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

/** Approximate chars-per-token used only for budgeting and estimates. */
export const CHARS_PER_TOKEN = 4;

/** Target chunk size in tokens (~500–800 from the plan). */
export const TARGET_CHUNK_TOKENS = 600;

/** Overlap as a fraction of the target chunk (~10–15%). */
export const CHUNK_OVERLAP_RATIO = 0.12;

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;
export const EMBEDDING_BATCH_SIZE = 64;
