"use client";

import { useEffect, useState } from "react";

import {
  DEFAULT_RETRIEVE_MIN_SCORE,
  DEFAULT_RETRIEVE_TOP_K,
} from "@/lib/documents/constants";

type DocumentOption = {
  id: string;
  title: string;
  status: string;
};

type RetrievedChunk = {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  headingPath: string | null;
  content: string;
  tokenEstimate: number;
  score: number;
};

type RetrieveResponse = {
  query: string;
  topK: number;
  minScore: number;
  grounded: boolean;
  bestScore: number | null;
  results: RetrievedChunk[];
  error?: string;
};

export function RetrieveDebugger() {
  const [query, setQuery] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [documents, setDocuments] = useState<DocumentOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RetrieveResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch("/api/documents");
        const data = (await response.json()) as {
          documents?: DocumentOption[];
        };
        if (!cancelled) {
          setDocuments(
            (data.documents ?? []).filter((doc) => doc.status === "ready"),
          );
        }
      } catch {
        // Document filter is optional; ignore list failures here.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const response = await fetch("/api/retrieve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          topK: DEFAULT_RETRIEVE_TOP_K,
          minScore: DEFAULT_RETRIEVE_MIN_SCORE,
          documentId: documentId || undefined,
        }),
      });

      const data = (await response.json()) as RetrieveResponse;
      if (!response.ok) {
        throw new Error(data.error ?? "Retrieval failed");
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retrieval failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="query" className="text-sm font-medium text-zinc-800">
            Question
          </label>
          <textarea
            id="query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            rows={3}
            placeholder="How do I authenticate API requests?"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-500"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="documentId"
            className="text-sm font-medium text-zinc-800"
          >
            Scope (optional)
          </label>
          <select
            id="documentId"
            value={documentId}
            onChange={(event) => setDocumentId(event.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500"
          >
            <option value="">All ready documents</option>
            {documents.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.title}
              </option>
            ))}
          </select>
        </div>

        <p className="text-sm text-zinc-500">
          Returns top {DEFAULT_RETRIEVE_TOP_K} chunks. Grounded signal uses min
          score {DEFAULT_RETRIEVE_MIN_SCORE}. No LLM answer is generated.
        </p>

        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="inline-flex w-fit items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Searching…" : "Retrieve chunks"}
        </button>
      </form>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {result ? (
        <section className="flex flex-col gap-4">
          <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
            <p>
              <span className="font-medium text-zinc-900">Grounded signal:</span>{" "}
              {result.grounded ? "yes" : "no"}
            </p>
            <p>
              <span className="font-medium text-zinc-900">Best score:</span>{" "}
              {result.bestScore === null ? "—" : result.bestScore.toFixed(4)}
            </p>
            <p>
              <span className="font-medium text-zinc-900">Results:</span>{" "}
              {result.results.length} / topK {result.topK}
            </p>
          </div>

          {result.results.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No ready chunks matched. Upload and index a document first.
            </p>
          ) : (
            <ul className="flex flex-col gap-4">
              {result.results.map((chunk, index) => (
                <li
                  key={chunk.chunkId}
                  className="border border-zinc-200 bg-white px-4 py-3"
                >
                  <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                    #{index + 1} · score {chunk.score.toFixed(4)} ·{" "}
                    {chunk.documentTitle} · chunk {chunk.chunkIndex}
                    {chunk.headingPath ? ` · ${chunk.headingPath}` : ""}
                  </p>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-sm text-zinc-800">
                    {chunk.content}
                  </pre>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
