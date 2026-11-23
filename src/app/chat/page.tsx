import Link from "next/link";

import { ChatPanel } from "@/components/chat/chat-panel";

export const metadata = {
  title: "Chat · RAGDocs",
  description: "Ask questions against indexed documentation with grounded answers",
};

export default function ChatPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-2">
        <Link
          href="/"
          className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
        >
          ← RAGDocs
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Grounded chat
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Ask the indexed docs. Answers stream as Markdown with highlighted
          code and linked citations; weak evidence produces a clear refusal.
        </p>
        <div className="flex flex-wrap gap-4 text-sm text-zinc-500">
          <Link
            href="/documents"
            className="hover:text-zinc-800 dark:hover:text-zinc-300"
          >
            Manage documents →
          </Link>
          <Link
            href="/retrieve"
            className="hover:text-zinc-800 dark:hover:text-zinc-300"
          >
            Retrieval debugger →
          </Link>
        </div>
      </div>
      <ChatPanel />
    </main>
  );
}
