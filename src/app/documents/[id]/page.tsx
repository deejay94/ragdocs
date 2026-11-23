import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { getDocumentWithChunks } from "@/lib/documents/ingest";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function DocumentDetailPage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-3xl px-6 py-12 text-sm text-zinc-500">
          Loading document…
        </main>
      }
    >
      <DocumentDetail params={params} />
    </Suspense>
  );
}

async function DocumentDetail({ params }: PageProps) {
  await connection();

  const { id } = await params;
  const result = await getDocumentWithChunks(id);

  if (!result) {
    notFound();
  }

  const { document, chunks } = result;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <div className="flex flex-col gap-2">
        <Link
          href="/documents"
          className="text-sm text-zinc-500 hover:text-zinc-800"
        >
          ← Documents
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
          {document.title}
        </h1>
        <p className="text-sm text-zinc-500">
          Status: {document.status} · {chunks.length} chunks ·{" "}
          {document.sourcePath}
        </p>
        {document.status === "failed" && document.errorMessage ? (
          <p className="text-sm text-red-700">{document.errorMessage}</p>
        ) : null}
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-zinc-900">Chunk preview</h2>
        {chunks.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No chunks stored for this document.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {chunks.map((chunk) => (
              <li
                key={chunk.id}
                className="border border-zinc-200 bg-zinc-50 px-4 py-3"
              >
                <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                  Chunk {chunk.chunkIndex}
                  {chunk.headingPath ? ` · ${chunk.headingPath}` : ""} · ~
                  {chunk.tokenEstimate} tokens
                </p>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-sm text-zinc-800">
                  {chunk.content}
                </pre>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
