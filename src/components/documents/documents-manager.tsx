"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type DocumentListItem = {
  id: string;
  title: string;
  status: "processing" | "ready" | "failed";
  mimeType: string;
  byteSize: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  chunkCount: number;
};

export function DocumentsManager() {
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    const response = await fetch("/api/documents");
    const data = (await response.json()) as {
      documents?: DocumentListItem[];
      error?: string;
    };

    if (!response.ok) {
      throw new Error(data.error ?? "Failed to load documents");
    }

    setDocuments(data.documents ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await refresh();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load documents");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refresh]);

  async function onUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      setError("Choose a .md or .txt file to upload.");
      return;
    }

    setUploading(true);
    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as {
        chunkCount?: number;
        document?: { title: string };
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Upload failed");
      }

      setMessage(
        `Indexed “${data.document?.title ?? file.name}” into ${data.chunkCount ?? 0} chunks.`,
      );
      form.reset();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      await refresh().catch(() => undefined);
    } finally {
      setUploading(false);
    }
  }

  async function onDelete(id: string, title: string) {
    setError(null);
    setMessage(null);

    const confirmed = window.confirm(`Delete “${title}” and its chunks?`);
    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    const data = (await response.json()) as { error?: string };

    if (!response.ok) {
      setError(data.error ?? "Delete failed");
      return;
    }

    setMessage(`Deleted “${title}”.`);
    await refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      <form
        onSubmit={onUpload}
        className="flex flex-col gap-4 border-b border-zinc-200 pb-8"
      >
        <div className="flex flex-col gap-2">
          <label htmlFor="file" className="text-sm font-medium text-zinc-800">
            Upload Markdown or plain text
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept=".md,.txt,text/markdown,text/plain"
            className="block w-full text-sm text-zinc-600 file:mr-4 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-700"
          />
          <p className="text-sm text-zinc-500">
            Max 2 MB. Files are chunked, embedded, and stored for retrieval.
          </p>
        </div>
        <button
          type="submit"
          disabled={uploading}
          className="inline-flex w-fit items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {uploading ? "Indexing…" : "Upload and index"}
        </button>
      </form>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {message}
        </p>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-zinc-900">Documents</h2>
        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : documents.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No documents yet. Upload a `.md` or `.txt` file to get started.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 border border-zinc-200">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/documents/${doc.id}`}
                    className="font-medium text-zinc-900 hover:underline"
                  >
                    {doc.title}
                  </Link>
                  <p className="mt-1 text-sm text-zinc-500">
                    {doc.status} · {doc.chunkCount} chunks ·{" "}
                    {(doc.byteSize / 1024).toFixed(1)} KB
                  </p>
                  {doc.status === "failed" && doc.errorMessage ? (
                    <p className="mt-1 text-sm text-red-700">{doc.errorMessage}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => onDelete(doc.id, doc.title)}
                  className="inline-flex w-fit items-center rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
