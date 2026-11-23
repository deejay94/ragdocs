import {
  CHARS_PER_TOKEN,
  CHUNK_OVERLAP_RATIO,
  TARGET_CHUNK_TOKENS,
} from "@/lib/documents/constants";

export type TextChunk = {
  content: string;
  headingPath: string | null;
  chunkIndex: number;
  tokenEstimate: number;
};

export type ChunkOptions = {
  targetTokens?: number;
  overlapRatio?: number;
};

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / CHARS_PER_TOKEN));
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\r\n/g, "\n").trim();
}

/**
 * Split plain text on paragraph boundaries, then by sentences/characters
 * when a block still exceeds the target size. Applies overlap between pieces.
 */
function splitOversizedBlock(
  text: string,
  targetChars: number,
  overlapChars: number,
): string[] {
  const normalized = text.trim();
  if (!normalized) {
    return [];
  }

  if (normalized.length <= targetChars) {
    return [normalized];
  }

  const paragraphs = normalized.split(/\n{2,}/);
  const pieces: string[] = [];
  let buffer = "";

  const flushBuffer = () => {
    if (buffer.trim()) {
      pieces.push(...hardSplit(buffer.trim(), targetChars, overlapChars));
    }
    buffer = "";
  };

  for (const paragraph of paragraphs) {
    const candidate = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    if (candidate.length <= targetChars) {
      buffer = candidate;
      continue;
    }
    flushBuffer();
    if (paragraph.length <= targetChars) {
      buffer = paragraph;
    } else {
      pieces.push(...hardSplit(paragraph, targetChars, overlapChars));
    }
  }

  flushBuffer();
  return pieces;
}

function hardSplit(
  text: string,
  targetChars: number,
  overlapChars: number,
): string[] {
  if (text.length <= targetChars) {
    return [text];
  }

  const parts: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + targetChars, text.length);

    if (end < text.length) {
      const window = text.slice(start, end);
      const breakAt = Math.max(
        window.lastIndexOf("\n"),
        window.lastIndexOf(". "),
        window.lastIndexOf(" "),
      );
      if (breakAt > targetChars * 0.4) {
        end = start + breakAt + 1;
      }
    }

    const slice = text.slice(start, end).trim();
    if (slice) {
      parts.push(slice);
    }

    if (end >= text.length) {
      break;
    }

    start = Math.max(end - overlapChars, start + 1);
  }

  return parts;
}

type Section = {
  headingPath: string | null;
  body: string;
};

/**
 * Prefer ATX heading boundaries for Markdown; fall back to a single section
 * for plain text. Large sections are split with overlap.
 */
export function chunkText(
  rawText: string,
  options: ChunkOptions = {},
): TextChunk[] {
  const targetTokens = options.targetTokens ?? TARGET_CHUNK_TOKENS;
  const overlapRatio = options.overlapRatio ?? CHUNK_OVERLAP_RATIO;
  const targetChars = targetTokens * CHARS_PER_TOKEN;
  const overlapChars = Math.floor(targetChars * overlapRatio);

  const text = normalizeWhitespace(rawText);
  if (!text) {
    return [];
  }

  const sections = splitIntoHeadingSections(text);
  const chunks: TextChunk[] = [];

  for (const section of sections) {
    const pieces = splitOversizedBlock(section.body, targetChars, overlapChars);
    for (const piece of pieces) {
      chunks.push({
        content: piece,
        headingPath: section.headingPath,
        chunkIndex: chunks.length,
        tokenEstimate: estimateTokens(piece),
      });
    }
  }

  return chunks;
}

function splitIntoHeadingSections(text: string): Section[] {
  const lines = text.split("\n");
  const headingPattern = /^(#{1,6})\s+(.+)$/;
  const hasHeadings = lines.some((line) => headingPattern.test(line.trim()));

  if (!hasHeadings) {
    return [{ headingPath: null, body: text }];
  }

  const sections: Section[] = [];
  const stack: { level: number; title: string }[] = [];
  let currentPath: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    const body = buffer.join("\n").trim();
    if (body) {
      sections.push({ headingPath: currentPath, body });
    }
    buffer = [];
  };

  for (const line of lines) {
    const match = line.trim().match(headingPattern);
    if (!match) {
      buffer.push(line);
      continue;
    }

    flush();

    const level = match[1].length;
    const title = match[2].trim();
    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }
    stack.push({ level, title });
    currentPath = stack.map((entry) => entry.title).join(" > ");
    buffer.push(line);
  }

  flush();
  return sections.length > 0 ? sections : [{ headingPath: null, body: text }];
}
