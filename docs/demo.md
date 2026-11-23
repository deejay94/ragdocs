# RAGDocs demo script (~5–10 minutes)

Prerequisites: Docker Postgres up, `.env.local` with `DATABASE_URL` + `OPENAI_API_KEY`, migrations applied, `npm run dev`.

1. **Health** — `curl http://localhost:3000/api/health` → `"database":"up"`.
2. **Upload** — Open `/documents` and upload `fixtures/sample-api-guide.md` (or curl the multipart endpoint). Confirm status `ready` and chunk previews.
3. **Retrieve** — Open `/retrieve`, ask: `How do I authenticate API requests?` Confirm the Authentication chunk ranks high and grounded is yes.
4. **Chat (grounded)** — Open `/chat`, ask the same question. Confirm a Markdown answer, highlighted code fence, and linked Sources.
5. **Chat (refusal)** — Ask: `What is the capital of Mars and the recipe for purple soup?` Confirm a refusal callout and no invented citations.
6. **Eval (optional)** — In another terminal: `npm run eval:retrieval` → expect `PASS` with hit@k and grounded accuracy above the golden thresholds.

Talking points: explicit pipeline modules, grounding gate before generation, citations from retrieved chunks, rate limits on write/chat endpoints.
