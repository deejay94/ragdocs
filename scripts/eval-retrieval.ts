import { config as loadEnv } from "dotenv";
import { readFile } from "node:fs/promises";
import path from "node:path";

// Load env before importing modules that create the DB client at import time.
loadEnv({ path: ".env.local" });
loadEnv();

type GoldenCase = {
  id: string;
  query: string;
  expectGrounded: boolean;
  headingContains?: string;
  contentContains?: string;
};

type GoldenSet = {
  version: number;
  documentTitle: string;
  fixturePath: string;
  topK: number;
  minScore: number;
  thresholds: {
    hitAtK: number;
    groundedAccuracy: number;
  };
  cases: GoldenCase[];
};

type RetrievedChunk = {
  headingPath: string | null;
  content: string;
};

function matchesEvidence(
  chunk: RetrievedChunk,
  testCase: GoldenCase,
): boolean {
  const headingOk = testCase.headingContains
    ? (chunk.headingPath ?? "")
        .toLowerCase()
        .includes(testCase.headingContains.toLowerCase())
    : true;
  const contentOk = testCase.contentContains
    ? chunk.content
        .toLowerCase()
        .includes(testCase.contentContains.toLowerCase())
    : true;

  if (testCase.headingContains && testCase.contentContains) {
    return headingOk || contentOk;
  }
  if (testCase.headingContains) return headingOk;
  if (testCase.contentContains) return contentOk;
  return false;
}

function firstHitRank(
  results: RetrievedChunk[],
  testCase: GoldenCase,
): number | null {
  for (let i = 0; i < results.length; i += 1) {
    if (matchesEvidence(results[i], testCase)) {
      return i + 1;
    }
  }
  return null;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required. Copy .env.example to .env.local.");
  }
  if (
    !process.env.OPENAI_API_KEY ||
    process.env.OPENAI_API_KEY === "sk-your-key-here"
  ) {
    throw new Error("OPENAI_API_KEY is required to run retrieval eval.");
  }

  const { closeDb } = await import("@/lib/db");
  const { ingestUploadedFile, listDocuments } = await import(
    "@/lib/documents/ingest"
  );
  const { retrieveRelevantChunks } = await import("@/lib/rag/retrieve");

  const goldenPath = path.resolve(
    process.cwd(),
    "fixtures/eval/golden-set.json",
  );
  const golden = JSON.parse(await readFile(goldenPath, "utf8")) as GoldenSet;

  const docs = await listDocuments();
  const existing = docs.find(
    (doc) =>
      doc.status === "ready" &&
      doc.title === golden.documentTitle &&
      Number(doc.chunkCount) > 0,
  );

  let documentId: string;
  if (existing) {
    documentId = existing.id;
    console.log(`Using ready document: ${documentId} (${existing.title})`);
  } else {
    const fixtureAbs = path.resolve(process.cwd(), golden.fixturePath);
    console.log(
      `No ready "${golden.documentTitle}" found. Ingesting ${fixtureAbs}…`,
    );
    const bytes = await readFile(fixtureAbs);
    const result = await ingestUploadedFile({
      filename: path.basename(fixtureAbs),
      bytes,
    });
    if (result.document.status !== "ready") {
      throw new Error(
        `Fixture ingest failed: ${result.document.errorMessage ?? "unknown error"}`,
      );
    }
    documentId = result.document.id;
    console.log(
      `Indexed fixture as ${documentId} (${result.chunkCount} chunks)`,
    );
  }

  const hitCases = golden.cases.filter((c) => c.expectGrounded);
  let hits = 0;
  let reciprocalRankSum = 0;
  let groundedCorrect = 0;

  console.log("");
  console.log("id".padEnd(22), "grounded", "expect", "hit", "rank", "best");
  console.log("-".repeat(72));

  for (const testCase of golden.cases) {
    const result = await retrieveRelevantChunks({
      query: testCase.query,
      topK: golden.topK,
      minScore: golden.minScore,
      documentId,
    });

    const groundedOk = result.grounded === testCase.expectGrounded;
    if (groundedOk) groundedCorrect += 1;

    let hitLabel = "n/a";
    let rankLabel = "-";

    if (testCase.expectGrounded) {
      const rank = firstHitRank(result.results, testCase);
      const hit = rank !== null;
      if (hit) {
        hits += 1;
        reciprocalRankSum += 1 / rank;
      }
      hitLabel = hit ? "yes" : "NO";
      rankLabel = rank === null ? "-" : String(rank);
    }

    console.log(
      testCase.id.padEnd(22),
      String(result.grounded).padEnd(8),
      String(testCase.expectGrounded).padEnd(6),
      hitLabel.padEnd(4),
      rankLabel.padEnd(4),
      result.bestScore === null ? "-" : result.bestScore.toFixed(3),
    );
  }

  const hitAtK = hitCases.length === 0 ? 1 : hits / hitCases.length;
  const mrr = hitCases.length === 0 ? 1 : reciprocalRankSum / hitCases.length;
  const groundedAccuracy = groundedCorrect / golden.cases.length;

  console.log("");
  console.log("Metrics");
  console.log(
    `  hit@${golden.topK}:           ${hitAtK.toFixed(3)} (${hits}/${hitCases.length})`,
  );
  console.log(`  MRR:              ${mrr.toFixed(3)}`);
  console.log(
    `  grounded accuracy:${groundedAccuracy.toFixed(3)} (${groundedCorrect}/${golden.cases.length})`,
  );
  console.log(
    `  thresholds:       hit@k>=${golden.thresholds.hitAtK}, grounded>=${golden.thresholds.groundedAccuracy}`,
  );

  const passed =
    hitAtK >= golden.thresholds.hitAtK &&
    groundedAccuracy >= golden.thresholds.groundedAccuracy;

  console.log("");
  console.log(passed ? "PASS" : "FAIL");

  await closeDb();
  process.exit(passed ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  try {
    const { closeDb } = await import("@/lib/db");
    await closeDb();
  } catch {
    // ignore shutdown errors
  }
  process.exit(1);
});
