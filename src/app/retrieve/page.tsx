import Link from "next/link";

import { RetrieveDebugger } from "@/components/retrieve/retrieve-debugger";

export const metadata = {
  title: "Retrieve · RAGDocs",
  description: "Debug semantic retrieval over indexed documentation chunks",
};

export default function RetrievePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-2">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-800">
          ← RAGDocs
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
          Retrieval debugger
        </h1>
        <p className="text-zinc-600">
          Embed a question and inspect the top matching documentation chunks
          and similarity scores. Answer generation comes in the next milestone.
        </p>
        <Link
          href="/documents"
          className="text-sm text-zinc-500 hover:text-zinc-800"
        >
          Manage documents →
        </Link>
      </div>
      <RetrieveDebugger />
    </main>
  );
}
