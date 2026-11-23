"use client";

import { useEffect, useState } from "react";

import { CitationList } from "@/components/chat/citation-list";
import { MarkdownAnswer } from "@/components/chat/markdown-answer";
import type { Citation, ChatStreamEvent } from "@/lib/chat/types";

type DocumentOption = {
  id: string;
  title: string;
  status: string;
};

type ChatTurn = {
  id: string;
  role: "user" | "assistant";
  content: string;
  grounded?: boolean | null;
  bestScore?: number | null;
  citations?: Citation[];
  isRefusal?: boolean;
};

const fieldClassName =
  "w-full rounded-md border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-400 shadow-sm outline-none focus:border-zinc-400";

export function ChatPanel() {
  const [query, setQuery] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [documents, setDocuments] = useState<DocumentOption[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
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

  function updateAssistantTurn(
    turnId: string,
    patch: Partial<ChatTurn> | ((prev: ChatTurn) => ChatTurn),
  ) {
    setTurns((prev) =>
      prev.map((turn) => {
        if (turn.id !== turnId) return turn;
        return typeof patch === "function" ? patch(turn) : { ...turn, ...patch };
      }),
    );
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || loading) return;

    setError(null);
    setLoading(true);
    setQuery("");

    const userTurnId = crypto.randomUUID();
    const assistantTurnId = crypto.randomUUID();

    setTurns((prev) => [
      ...prev,
      { id: userTurnId, role: "user", content: trimmed },
      {
        id: assistantTurnId,
        role: "assistant",
        content: "",
        grounded: null,
        bestScore: null,
        citations: [],
      },
    ]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: trimmed,
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
            updateAssistantTurn(assistantTurnId, {
              grounded: event.grounded,
              bestScore: event.bestScore,
              citations: event.citations,
              isRefusal: !event.grounded,
            });
          } else if (event.type === "token") {
            updateAssistantTurn(assistantTurnId, (turn) => ({
              ...turn,
              content: turn.content + event.content,
            }));
          } else if (event.type === "refusal") {
            updateAssistantTurn(assistantTurnId, {
              content: event.content,
              isRefusal: true,
              citations: [],
            });
          } else if (event.type === "error") {
            throw new Error(event.error);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chat failed");
      setTurns((prev) =>
        prev.filter(
          (turn) => turn.id !== userTurnId && turn.id !== assistantTurnId,
        ),
      );
      setQuery(trimmed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {turns.length > 0 ? (
        <div className="flex flex-col gap-4">
          {turns.map((turn) =>
            turn.role === "user" ? (
              <div
                key={turn.id}
                className="ml-8 rounded-md border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white"
              >
                <p className="text-xs font-medium tracking-wide text-zinc-400 uppercase">
                  You
                </p>
                <p className="mt-1 whitespace-pre-wrap">{turn.content}</p>
              </div>
            ) : (
              <div
                key={turn.id}
                className={
                  turn.isRefusal
                    ? "mr-8 rounded-md border border-amber-700/50 bg-amber-950/40 px-4 py-3"
                    : "mr-8 rounded-md border border-zinc-700 bg-zinc-950 px-4 py-3"
                }
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-xs font-medium tracking-wide text-zinc-400 uppercase">
                    {turn.isRefusal ? "Refusal" : "Assistant"}
                  </p>
                  {turn.grounded !== null && turn.grounded !== undefined ? (
                    <p className="text-xs text-zinc-500">
                      grounded: {turn.grounded ? "yes" : "no"}
                      {turn.bestScore !== null && turn.bestScore !== undefined
                        ? ` · best ${turn.bestScore.toFixed(4)}`
                        : ""}
                    </p>
                  ) : null}
                </div>

                <div className="mt-2">
                  {turn.content ? (
                    turn.isRefusal ? (
                      <p className="text-sm leading-relaxed text-amber-100">
                        {turn.content}
                      </p>
                    ) : (
                      <MarkdownAnswer content={turn.content} />
                    )
                  ) : (
                    <p className="text-sm text-zinc-500">
                      {loading ? "Thinking…" : "…"}
                    </p>
                  )}
                </div>

                {turn.citations && turn.citations.length > 0 ? (
                  <div className="mt-3">
                    <CitationList citations={turn.citations} />
                  </div>
                ) : null}
              </div>
            ),
          )}
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label
            htmlFor="query"
            className="text-sm font-medium text-zinc-200 dark:text-zinc-200"
          >
            Question
          </label>
          <textarea
            id="query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            rows={3}
            placeholder="How do I authenticate API requests?"
            className={fieldClassName}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="documentId"
            className="text-sm font-medium text-zinc-200"
          >
            Scope (optional)
          </label>
          <select
            id="documentId"
            value={documentId}
            onChange={(event) => setDocumentId(event.target.value)}
            className={fieldClassName}
          >
            <option value="">All ready documents</option>
            {documents.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.title}
              </option>
            ))}
          </select>
        </div>

        <p className="text-sm text-zinc-400">
          Answers render as Markdown with highlighted code. Weak retrieval
          yields a refusal instead of a guessed answer.
          {conversationId ? (
            <>
              {" "}
              Conversation:{" "}
              <span className="font-mono text-xs text-zinc-500">
                {conversationId}
              </span>
            </>
          ) : null}
        </p>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="inline-flex w-fit items-center justify-center rounded-md bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Answering…" : "Ask"}
          </button>
          {turns.length > 0 || conversationId ? (
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setConversationId(null);
                setTurns([]);
                setError(null);
              }}
              className="inline-flex w-fit items-center justify-center rounded-md border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-900 disabled:opacity-60"
            >
              New conversation
            </button>
          ) : null}
        </div>
      </form>

      {error ? (
        <p className="rounded-md border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}
    </div>
  );
}
