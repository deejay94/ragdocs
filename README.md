# RAGDocs

**RAGDocs** is an AI-powered developer documentation assistant built with retrieval-augmented generation (RAG). Upload technical documentation, ask natural-language questions, and receive answers grounded in retrieved source chunks—with citations and explicit refusal when the docs do not contain the answer.

---

## Overview

RAGDocs keeps the retrieval pipeline explicit and easy to follow:

1. **Ingest** documentation into chunked, embedded units of text  
2. **Retrieve** the most relevant chunks for a question  
3. **Generate** an answer constrained to that context  
4. **Cite** the sources that supported the answer—or state that the docs do not cover it  

The core path is implemented in focused modules rather than behind a heavy RAG framework, so each stage—chunking, embedding, retrieval, and prompting—stays visible and maintainable.

---

## Features

| Capability | Status |
| --- | --- |
| Next.js + TypeScript application skeleton | Done |
| Local Postgres + pgvector via Docker Compose | Done |
| Drizzle schema, migrations, and health check | Done |
| Document upload (Markdown / plain text) | Done |
| Chunking, embedding, and vector storage | Done |
| Documents list / detail / delete UI | Done |
| Semantic retrieval with similarity search | Done |
| Retrieval debugger UI | Done |
| Grounded LLM answers with source citations | Done |
| Refusal when evidence is insufficient | Done |
| Thin chat smoke UI (streaming + citation list) | Done |
| Chat UI with Markdown and code formatting | Done |
| Rate limiting, OpenAI retries, safer API errors | Done |
| Retrieval quality eval harness | Done |
| Architecture + demo docs | Done |

---

## Architecture

Monolithic **Next.js App Router** app with clear internal boundaries (UI / API / RAG core / persistence)—the same high-level shape as the original Section 1 plan:

![RAGDocs architecture](docs/architecture-diagram.jpg)

Chat/docs UI talks to API routes for upload and Q&A. Ingestion writes files plus embedded chunks to Postgres/pgvector; retrieval runs similarity search and feeds answer generation; OpenAI supplies embeddings and chat. Chunking, embedding, retrieval, prompting, and generation live under `src/lib/rag/`. Ingestion lives under `src/lib/documents/`. Conversation persistence lives under `src/lib/chat/`. Editable Mermaid + pipeline notes: [`docs/architecture.md`](docs/architecture.md).

---

## Tech stack

| Layer | Choice | Rationale |
| --- | --- | --- |
| Language | TypeScript | Shared types across UI, API, and RAG data models |
| App | Next.js (App Router) | Single TypeScript app for UI and APIs |
| Styling | Tailwind CSS | Fast, maintainable UI without a custom design system |
| Database | Postgres + pgvector | Documents, metadata, and vectors in one system |
| ORM | Drizzle ORM | Typed schema and SQL migrations with first-class vector support |
| DB driver | postgres.js | Lightweight Postgres client used by the Drizzle server singleton |
| Local DB | Docker Compose (`pgvector/pgvector:pg16`) | Reproducible local setup |
| LLM / embeddings | OpenAI | `text-embedding-3-small` + chat (`gpt-4o-mini` by default) |
| Validation | Zod | Request validation at API boundaries |
| Markdown UI | react-markdown + remark-gfm + rehype-highlight | Grounded answers with GFM tables and highlighted fences |

---

## Prerequisites

- **Node.js** 20 or newer  
- **npm**  
- **Docker Desktop** (or another engine that supports `docker compose`) for the local database  
- `DATABASE_URL` pointing at Postgres (required for migrations, health, and ingest)  
- An **OpenAI API key** (required to embed documents and generate answers)

---

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/deejay94/ragdocs.git
cd ragdocs
git checkout staging
npm install
```

Active development happens on `staging`. `main` is updated when changes are intentionally promoted.

### 2. Configure environment

```bash
cp .env.example .env.local
```

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Required to embed documents and generate grounded answers |
| `CHAT_MODEL` | Optional chat model override (default `gpt-4o-mini`) |
| `RATE_LIMIT_CHAT_PER_MIN` | Optional chat POST ceiling per IP (default `10`) |
| `RATE_LIMIT_RETRIEVE_PER_MIN` | Optional retrieve POST ceiling per IP (default `30`) |
| `RATE_LIMIT_DOCUMENTS_WRITE_PER_MIN` | Optional upload POST ceiling per IP (default `10`) |
| `DATABASE_URL` | Postgres connection string (matches Compose defaults) |

Default database URL:

```text
postgresql://ragdocs:ragdocs@localhost:5432/ragdocs
```

### 3. Start Postgres with pgvector

```bash
docker compose up -d
```

Confirm the container is healthy:

```bash
docker compose ps
```

### 4. Run database migrations

```bash
npm run db:migrate
```

This enables the `vector` extension and creates the `documents`, `chunks`, `conversations`, and `messages` tables.

### 5. Run the app

```bash
npm run dev
```

Open:

- [http://localhost:3000/chat](http://localhost:3000/chat) — grounded Q&A  
- [http://localhost:3000/documents](http://localhost:3000/documents) — upload and manage docs  
- [http://localhost:3000/retrieve](http://localhost:3000/retrieve) — debug similarity search  

Verify database connectivity:

```bash
curl http://localhost:3000/api/health
```

Expected response when Postgres is reachable:

```json
{ "ok": true, "service": "ragdocs", "database": "up", "checkedAt": "..." }
```

Upload the included sample guide (requires `OPENAI_API_KEY`):

```bash
curl -F "file=@./fixtures/sample-api-guide.md" http://localhost:3000/api/documents
```

Retrieve top matching chunks for a question:

```bash
curl -X POST http://localhost:3000/api/retrieve \
  -H 'content-type: application/json' \
  -d '{"query":"How do I authenticate API requests?"}'
```

The response includes ranked chunks, cosine similarity scores, and a `grounded` flag based on the minimum score threshold (default `0.3`).

Ask a grounded question (SSE stream — `meta` → `token`/`refusal` → `done`):

```bash
curl -N -X POST http://localhost:3000/api/chat \
  -H 'content-type: application/json' \
  -d '{"query":"How do I authenticate API requests?"}'
```

When retrieval is not grounded, the API returns a fixed refusal and does not call the chat model.

Write endpoints are rate-limited per IP (in-memory). Bursting chat/upload/retrieve returns `429` with `Retry-After`. JSON bodies are capped at 32 KB; uploads remain capped at 2 MB.

### 6. Production build check

```bash
npm run lint
npm run build
```

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create an optimized production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm run db:generate` | Generate SQL migrations from the Drizzle schema |
| `npm run db:migrate` | Apply pending migrations to Postgres |
| `npm run db:studio` | Open Drizzle Studio against `DATABASE_URL` |
| `npm run eval:retrieval` | Run golden-set retrieval metrics (needs DB + OpenAI key) |

---

## Ingestion pipeline

Uploading a `.md` or `.txt` file (max 2 MB) runs this path end to end:

1. **Validate** — allowlisted extensions; reject empty or oversized files; require `OPENAI_API_KEY` before writing state  
2. **Store** — save the raw file under `uploads/{documentId}/` with a sanitized filename  
3. **Parse** — UTF-8 text; title from the first Markdown H1 or the filename  
4. **Chunk** — heading-aware Markdown sections, then overlapping splits (~600 tokens, ~12% overlap)  
5. **Embed** — batch `text-embedding-3-small` vectors (1536 dimensions)  
6. **Index** — insert chunks, then mark the document `ready` (or `failed` with an error message and no orphan chunks)

## Retrieval pipeline

`POST /api/retrieve` embeds the question with the same model used at ingest time, then runs cosine similarity search over ready chunks (HNSW index):

1. Embed the query (`text-embedding-3-small`)  
2. Rank chunks by `1 - cosine_distance`  
3. Return top-k results (default `5`) with document title, heading path, content, and score  
4. Set `grounded: true` when the best score meets `minScore` (default `0.3`)

Optional `documentId` scopes search to a single document. Use `/retrieve` to inspect results visually.

## Grounded chat pipeline

`POST /api/chat` runs retrieve-then-generate:

1. Create or reuse a conversation; store the user message  
2. Retrieve top-k ready chunks (same thresholds as `/api/retrieve`)  
3. If not grounded → emit a fixed refusal, store it, **skip** the chat LLM  
4. If grounded → prompt with numbered context chunks → stream tokens → store the assistant reply with `citationsJson`  

SSE event types: `meta` (conversation id, grounded flag, citations), `token`, `refusal`, `done`, `error`. Use `/chat` for the Markdown chat UI with highlighted code and linked citations.

## Hardening

- **Rate limits** — fixed-window per IP on `POST /api/chat`, `POST /api/retrieve`, and `POST /api/documents` (single-process memory; use Redis for multi-instance)  
- **Body limits** — 32 KB JSON for chat/retrieve; 2 MB file uploads  
- **OpenAI retries** — up to 3 attempts with exponential backoff on 429/5xx and network errors  
- **Safer errors** — responses use stable `{ error, code }` messages; details are logged server-side  

## Evaluation

Golden questions live in `fixtures/eval/golden-set.json` (aligned to the sample Payments API guide). Run:

```bash
npm run eval:retrieval
```

The script indexes the fixture if needed, then reports hit@k, MRR, and grounded accuracy. It exits non-zero below the configured thresholds. Deeper architecture notes and a manual walkthrough are in [`docs/architecture.md`](docs/architecture.md) and [`docs/demo.md`](docs/demo.md).

## Data model

| Table | Purpose |
| --- | --- |
| `documents` | Uploaded documentation metadata and ingestion status (`processing` / `ready` / `failed`) |
| `chunks` | Text segments with `vector(1536)` embeddings and an HNSW cosine index |
| `conversations` | Lightweight chat session IDs |
| `messages` | Chat turns with optional citation JSON on assistant replies |

Deleting a document cascades to its chunks and removes the local upload directory. Deleting a conversation cascades to its messages.

---

## Repository layout

```text
ragdocs/
├── docker-compose.yml
├── docs/                      # Architecture + demo script
├── drizzle/
├── fixtures/                  # Sample docs + eval golden set
├── scripts/                   # CLI eval harness
├── uploads/                   # Local uploaded files (gitignored)
└── src/
    ├── app/
    │   ├── api/health/
    │   ├── api/documents/     # list, upload, detail, delete
    │   ├── api/retrieve/      # semantic search
    │   ├── api/chat/          # grounded Q&A (SSE)
    │   ├── documents/         # upload / manage UI
    │   ├── retrieve/          # retrieval debugger UI
    │   └── chat/              # grounded chat UI
    ├── components/
    │   ├── chat/              # Markdown answer, citations, panel
    │   ├── documents/
    │   └── retrieve/
    └── lib/
        ├── chat/              # answer orchestration + persistence
        ├── db/                # schema + client
        ├── documents/         # parse, store, ingest
        ├── http/              # public errors + body limits
        ├── openai.ts
        ├── openai/            # retry helper
        ├── security/          # rate limits
        └── rag/
            ├── chunk.ts
            ├── embed.ts
            ├── retrieve.ts
            ├── prompt.ts
            └── generate.ts
```

---

## Roadmap

1. **Project skeleton** — Next.js, TypeScript, Tailwind, env template, Docker Compose, documentation  
2. **Database layer** — Drizzle schema and migrations for documents, chunks (pgvector), conversations, and messages  
3. **Ingestion** — Upload Markdown/text, chunk, embed, and store with a clear status lifecycle  
4. **Retrieval** — Query embedding and top-k similarity search (including a debug view)  
5. **Grounded chat** — Prompting, similarity threshold refusal, streaming answers, citation metadata  
6. **Chat UI** — Markdown/code rendering and citation presentation  
7. **Hardening** — Upload limits, rate limiting, retries, safer errors  
8. **Eval + docs** — Golden-set retrieval metrics and architecture write-up ← *current*  

---

## Design principles

- **Explicit pipeline** — Prefer clear modules over opaque framework magic for the RAG core.  
- **Grounding first** — Answers must be tied to retrieved context; insufficient evidence yields a clear refusal.  
- **Citations by default** — Grounded answers show where claims came from.  
- **TypeScript throughout** — Shared models for documents, chunks, citations, and API contracts.  
- **Safe defaults** — No secrets in the repository; server-side API keys only.

---

## Security notes

- Never commit `.env.local` or real API keys. Only `.env.example` is tracked.  
- Uploaded files are stored under `uploads/` locally and are gitignored.  
- Treat retrieved document text as untrusted input when prompting the model (prompt-injection awareness).  
- Chat, retrieve, and upload endpoints are rate-limited per IP in-process; swap in a shared store before multi-instance deploy.  
- Keep OpenAI keys server-side only.

---

## Current status

**Milestones 1–8 are complete.** Full path: ingest → retrieve → grounded chat (or refuse), with hardening plus a golden-set retrieval eval and architecture/demo docs.

---

## License

No license file has been added yet. If you fork or reuse this project, assume all rights reserved by the author until a license is published.
