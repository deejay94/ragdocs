"use client";

import { useEffect, useState } from "react";

import type { Citation, ChatStreamEvent } from "@/lib/chat/types";

type DocumentOption = {
  id: string;
  title: string;
  status: string;
};

export function ChatSmoke() {
  const [query, setQuery] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [documents, setDocuments] = useState<DocumentOption[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [grounded, setGrounded] = useState<boolean | null>(null);
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        // Optional filter.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setAnswer("");
    setCitations([]);
    setGrounded(null);
    setBestScore(null);
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          conversationId: conversationId ?? undefined,
          documentId: documentId || undefined,
        }),
      });

      if (!response.ok || !response.body) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "Chat request failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part
            .split("\n")
            .find((entry) => entry.startsWith("data: "));
          if (!line) continue;

          const event = JSON.parse(line.slice(6)) as ChatStreamEvent;

          if (event.type === "meta") {
            setConversationId(event.conversationId);
            setGrounded(event.grounded);
            setBestScore(event.bestScore);
            setCitations(event.citations);
          } else if (event.type === "token") {
            setAnswer((prev) => prev + event.content);
          } else if (event.type === "refusal") {
            setAnswer(event.content);
          } else if (event.type === "error") {
            throw new Error(event.error);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chat failed");
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
          Streams a grounded answer when retrieval clears the min score. Plain
          text for now — Markdown polish is Milestone 6.
          {conversationId ? (
            <>
              {" "}
              Conversation:{" "}
              <span className="font-mono text-xs text-zinc-600">
                {conversationId}
              </span>
            </>
          ) : null}
        </p>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="inline-flex w-fit items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Answering…" : "Ask"}
          </button>
          {conversationId ? (
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setConversationId(null);
                setAnswer("");
                setCitations([]);
                setGrounded(null);
                setBestScore(null);
                setError(null);
              }}
              className="inline-flex w-fit items-center justify-center rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
            >
              New conversation
            </button>
          ) : null}
        </div>
      </form>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {grounded !== null || answer ? (
        <section className="flex flex-col gap-4">
          <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
            <p>
              <span className="font-medium text-zinc-900">Grounded:</span>{" "}
              {grounded === null ? "—" : grounded ? "yes" : "no"}
            </p>
            <p>
              <span className="font-medium text-zinc-900">Best score:</span>{" "}
              {bestScore === null ? "—" : bestScore.toFixed(4)}
            </p>
          </div>

          {answer ? (
            <div className="border border-zinc-200 bg-white px-4 py-3">
              <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                Answer
              </p>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-sans text-sm leading-relaxed text-zinc-800">
                {answer}
              </pre>
            </div>
          ) : null}

          {citations.length > 0 ? (
            <div className="border border-zinc-200 bg-white px-4 py-3">
              <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                Citations
              </p>
              <ul className="mt-2 flex flex-col gap-2 text-sm text-zinc-700">
                {citations.map((citation, index) => (
                  <li key={citation.chunkId}>
                    [{index + 1}] {citation.documentTitle}
                    {citation.headingPath ? ` · ${citation.headingPath}` : ""}{" "}
                    · score {citation.score.toFixed(4)} · chunk{" "}
                    {citation.chunkIndex}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
