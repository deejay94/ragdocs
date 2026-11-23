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
| Document upload (Markdown / plain text) | Planned |
| Chunking, embedding, and vector storage | Planned |
| Semantic retrieval with similarity search | Planned |
| Grounded LLM answers with source citations | Planned |
| Refusal when evidence is insufficient | Planned |
| Chat UI with Markdown and code formatting | Planned |
| Retrieval quality eval harness | Planned |

---

## Architecture (target)

```text
Browser (chat + docs UI)
        │
        ▼
Next.js App Router (UI + API routes)
        │
        ├── Ingestion: parse → chunk → embed → store
        ├── Retrieval: embed query → top-k similarity search
        └── Generation: grounded prompt → streamed answer + citations
                │
                ├── Postgres + pgvector (documents, chunks, embeddings)
                └── OpenAI (embeddings + chat)
```

The RAG pipeline will live under `src/lib/rag/` with separate modules for chunking, embedding, retrieval, prompting, and generation.

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
| LLM / embeddings | OpenAI | Simple SDK and solid defaults (`text-embedding-3-small`, chat model via env) |
| Validation (upcoming) | Zod | Typed request/response boundaries at the API |

---

## Prerequisites

- **Node.js** 20 or newer  
- **npm**  
- **Docker Desktop** (or another engine that supports `docker compose`) for the local database  
- `DATABASE_URL` pointing at Postgres (required for migrations and `/api/health`)  
- An **OpenAI API key** for embedding and chat milestones (not required yet)

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
| `OPENAI_API_KEY` | Embeddings and chat (later milestones) |
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

Open [http://localhost:3000](http://localhost:3000).

Verify database connectivity:

```bash
curl http://localhost:3000/api/health
```

Expected response when Postgres is reachable:

```json
{ "ok": true, "service": "ragdocs", "database": "up", "checkedAt": "..." }
```

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

---

## Data model

| Table | Purpose |
| --- | --- |
| `documents` | Uploaded documentation metadata and ingestion status (`processing` / `ready` / `failed`) |
| `chunks` | Text segments with `vector(1536)` embeddings and an HNSW cosine index |
| `conversations` | Lightweight chat session IDs |
| `messages` | Chat turns with optional citation JSON on assistant replies |

Deleting a document cascades to its chunks. Deleting a conversation cascades to its messages.

---

## Repository layout

```text
ragdocs/
├── docker-compose.yml         # Local Postgres + pgvector
├── drizzle/                   # SQL migrations
├── drizzle.config.ts          # Drizzle Kit configuration
├── .env.example               # Environment variable template
├── public/                    # Static assets
└── src/
    ├── app/
    │   └── api/health/        # Liveness + DB connectivity
    └── lib/db/
        ├── schema.ts          # Tables, enums, indexes, relations
        └── index.ts           # Drizzle + postgres.js client
```

Planned structure:

```text
src/
├── app/api/              # documents, chat
├── components/           # chat, citations, upload
└── lib/
    ├── rag/              # chunk, embed, retrieve, prompt, generate
    └── documents/        # ingest orchestration
```

---

## Roadmap

1. **Project skeleton** — Next.js, TypeScript, Tailwind, env template, Docker Compose, documentation  
2. **Database layer** — Drizzle schema and migrations for documents, chunks (pgvector), conversations, and messages ← *current*  
3. **Ingestion** — Upload Markdown/text, chunk, embed, and store with a clear status lifecycle  
4. **Retrieval** — Query embedding and top-k similarity search (including a debug view)  
5. **Grounded chat** — Prompting, similarity threshold refusal, streaming answers, citation metadata  
6. **Chat UI** — Markdown/code rendering and citation presentation  
7. **Hardening** — Upload limits, rate limiting, retries, safer errors  
8. **Eval + docs** — Golden-set retrieval metrics and architecture write-up  

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
- Uploaded files will be stored under `uploads/` locally (gitignored) in later milestones.  
- Treat retrieved document text as untrusted input when prompting the model (prompt-injection awareness).  
- Before any public deployment: rate-limit chat and upload endpoints; keep OpenAI keys server-side only.

---

## Current status

**Milestones 1–2 are complete.** The app scaffolds cleanly, Postgres/pgvector runs locally, Drizzle migrations define the core tables, and `GET /api/health` reports database connectivity. Document ingestion, retrieval, and grounded chat are not implemented yet.

---

## License

No license file has been added yet. If you fork or reuse this project, assume all rights reserved by the author until a license is published.
