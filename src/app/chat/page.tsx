import Link from "next/link";

import { ChatSmoke } from "@/components/chat/chat-smoke";

export const metadata = {
  title: "Chat · RAGDocs",
  description: "Ask questions against indexed documentation with grounded answers",
};

export default function ChatPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-2">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-800">
          ← RAGDocs
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
          Grounded chat
        </h1>
        <p className="text-zinc-600">
          Retrieves relevant chunks, refuses when evidence is weak, and streams
          an answer constrained to that context. Markdown polish comes next.
        </p>
        <div className="flex flex-wrap gap-4 text-sm text-zinc-500">
          <Link href="/documents" className="hover:text-zinc-800">
            Manage documents →
          </Link>
          <Link href="/retrieve" className="hover:text-zinc-800">
            Retrieval debugger →
          </Link>
        </div>
      </div>
      <ChatSmoke />
    </main>
  );
}
