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
        Milestone 1 skeleton is running. Document upload, retrieval, and
        grounded chat arrive in later milestones.
      </p>
    </main>
  );
}
