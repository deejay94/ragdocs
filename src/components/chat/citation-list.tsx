import Link from "next/link";

import type { Citation } from "@/lib/chat/types";

type CitationListProps = {
  citations: Citation[];
};

export function CitationList({ citations }: CitationListProps) {
  if (citations.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-zinc-700 pt-3">
      <p className="text-xs font-medium tracking-wide text-zinc-400 uppercase">
        Sources
      </p>
      <ol className="mt-2 flex flex-col gap-2">
        {citations.map((citation, index) => (
          <li
            key={citation.chunkId}
            className="text-sm leading-snug text-zinc-300"
          >
            <span className="font-medium text-zinc-100">
              [{index + 1}]{" "}
              <Link
                href={`/documents/${citation.documentId}`}
                className="underline decoration-zinc-500 underline-offset-2 hover:text-white"
              >
                {citation.documentTitle}
              </Link>
            </span>
            {citation.headingPath ? (
              <span className="text-zinc-400"> · {citation.headingPath}</span>
            ) : null}
            <span className="block text-xs text-zinc-500">
              score {citation.score.toFixed(4)} · chunk {citation.chunkIndex}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
