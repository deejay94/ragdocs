import Link from "next/link";

import { DocumentsManager } from "@/components/documents/documents-manager";

export const metadata = {
  title: "Documents · RAGDocs",
  description: "Upload and manage documentation for RAGDocs",
};

export default function DocumentsPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-2">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-800">
          ← RAGDocs
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
          Documents
        </h1>
        <p className="text-zinc-600">
          Upload Markdown or plain-text docs. Each file is parsed, chunked,
          embedded, and stored in Postgres with pgvector.
        </p>
      </div>
      <DocumentsManager />
    </main>
  );
}
