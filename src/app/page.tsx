import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center gap-4 px-6 py-16">
      <p className="text-sm font-medium tracking-wide text-zinc-500 uppercase">
        RAGDocs
      </p>
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
        Developer documentation assistant
      </h1>
      <p className="text-lg leading-relaxed text-zinc-600">
        Upload technical docs, retrieve relevant chunks, and get answers
        grounded in that evidence—with refusal when the docs do not cover the
        question.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/chat"
          className="inline-flex w-fit items-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Ask docs
        </Link>
        <Link
          href="/documents"
          className="inline-flex w-fit items-center rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
        >
          Manage documents
        </Link>
        <Link
          href="/retrieve"
          className="inline-flex w-fit items-center rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
        >
          Retrieval debugger
        </Link>
      </div>
    </main>
  );
}
