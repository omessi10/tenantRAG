# Infoware — Multi-Tenant RAG API

A Node.js + TypeScript retrieval-augmented generation (RAG) service where multiple organizations upload knowledge (PDFs, policies, FAQs) and query answers scoped strictly to their own data.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Runtime | Node.js 20+, TypeScript |
| API | Fastify |
| Database | PostgreSQL + [pgvector](https://github.com/pgvector/pgvector) |
| LLM / Embeddings | OpenAI (`text-embedding-3-small`, `gpt-4o-mini`) |
| PDF parsing | `pdf-parse` |

## Quick Start

### 1. Start PostgreSQL (with pgvector)

```bash
docker compose up -d postgres
```

### 2. Configure environment

```bash
cp .env.example .env
# Add OPENAI_API_KEY for production-quality answers
# Or set MOCK_LLM=true for offline demo mode
```

### 3. Install & run

```bash
npm install
npm run db:migrate
npm run dev
```

Server: `http://localhost:3000`

### Full Docker stack

```bash
export OPENAI_API_KEY=sk-...
docker compose --profile full up --build
```

## API Reference

### Health

```http
GET /health
```

### Tenants

```http
POST /tenant
Content-Type: application/json

{ "name": "Acme Legal" }
```

```http
GET /tenant/:id
```

### Documents

```http
POST /tenant/:tenantId/documents
Content-Type: multipart/form-data

file: <pdf or text file>
```

```http
GET /tenant/:tenantId/documents
DELETE /tenant/:tenantId/documents/:documentId
```

### Query

```http
POST /tenant/:tenantId/query
Content-Type: application/json

{
  "question": "What is the refund policy?"
}
```

**Response:**

```json
{
  "answer": "...",
  "sources": [
    {
      "documentId": "...",
      "filename": "policy.pdf",
      "chunkIndex": 2,
      "excerpt": "...",
      "score": 0.82
    }
  ],
  "confidence": "high"
}
```

When guardrails block a request, `guardrail` is set (e.g. `PROMPT_INJECTION`, `LOW_CONFIDENCE`) and `confidence` is `blocked`.

## Example Flow

```bash
# Create tenant
TENANT=$(curl -s -X POST http://localhost:3000/tenant \
  -H 'Content-Type: application/json' \
  -d '{"name":"Demo School"}' | jq -r .id)

# Upload document
curl -X POST "http://localhost:3000/tenant/$TENANT/documents" \
  -F "file=@./samples/refund-policy.txt"

# Query
curl -X POST "http://localhost:3000/tenant/$TENANT/query" \
  -H 'Content-Type: application/json' \
  -d '{"question":"How long do I have to request a refund?"}'
```

## Multi-Tenant Isolation

- Every `documents` and `document_chunks` row stores `tenant_id`.
- All retrieval SQL includes `WHERE tenant_id = $1`.
- Middleware validates tenant exists before tenant-scoped routes run.
- Queries referencing another tenant's UUID are rejected.

## Guardrails

| Threat | Mitigation |
|--------|------------|
| Prompt injection | Pattern detection + context sanitization + fixed system prompt |
| Cross-tenant leakage | DB filters, tenant middleware, foreign UUID blocking |
| Out-of-scope questions | Heuristics for chit-chat / general knowledge |
| Low confidence | Minimum cosine similarity threshold + safe fallback |

## Project Structure

```
src/
├── api/           # Routes & Zod schemas
├── services/      # Business logic (ingest, query)
├── middleware/    # Tenant scope, errors
├── rag/           # Chunking, embeddings, guardrails, generation
├── models/        # Types & repositories
├── db/            # Pool & migrations
└── tests/         # Unit tests
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for design details.

## Tests

```bash
npm test
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | local postgres | PostgreSQL connection string |
| `OPENAI_API_KEY` | — | Required unless `MOCK_LLM=true` |
| `EMBEDDING_MODEL` | `text-embedding-3-small` | Embedding model |
| `CHAT_MODEL` | `gpt-4o-mini` | Chat completion model |
| `RETRIEVAL_MIN_SCORE` | `0.35` | Min similarity for context |
| `RETRIEVAL_TOP_K` | `5` | Chunks retrieved per query |
| `MOCK_LLM` | auto if no API key | Deterministic mock embeddings + answers |

## License

MIT — assignment submission.
