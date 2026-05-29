# Architecture Notes

## Overview

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Client    │────▶│  Fastify API │────▶│   PostgreSQL    │
│  (per org)  │     │  + middleware│     │  + pgvector     │
└─────────────┘     └──────┬───────┘     └─────────────────┘
                           │
                    ┌──────▼───────┐
                    │  OpenAI API  │
                    │ embed + chat │
                    └──────────────┘
```

Each customer (tenant) is an isolated namespace. Upload and query paths never access data without an explicit `tenant_id` filter at the repository layer.

## Data Model

```
tenants
  └── documents (tenant_id FK, status, chunk_count)
        └── document_chunks (tenant_id FK, embedding vector(1536))
```

**Cascade deletes:** Removing a tenant or document removes associated chunks automatically.

**Vector index:** HNSW index on `embedding` using cosine distance (`<=>` operator).

## Ingestion Pipeline

1. **Upload** — Multipart file received on `POST /tenant/:tenantId/documents`.
2. **Extract** — PDF via `pdf-parse`; plain text/markdown read as UTF-8.
3. **Chunk** — Sliding window (~800 chars, 120 overlap) with sentence-boundary preference.
4. **Embed** — Batch embedding via OpenAI (or deterministic mock vectors in dev).
5. **Store** — Chunks inserted with `tenant_id`, `document_id`, and vector.
6. **Status** — Document marked `ready` or `failed`.

## Query Pipeline

1. **Validate** — Zod schema + tenant middleware.
2. **Guardrails (pre-retrieval)** — Injection / scope / length checks.
3. **Embed query** — Same model as document chunks.
4. **Retrieve** — Top-K cosine similarity, **always** `WHERE tenant_id = $tenant`.
5. **Guardrails (post-retrieval)** — Min score threshold; empty results → fallback.
6. **Generate** — LLM with hardened system prompt and sanitized context blocks.
7. **Respond** — Answer + source citations with scores.

## Multi-Tenant Isolation Strategy

| Layer | Mechanism |
|-------|-----------|
| API | `requireTenant` preHandler on all `/tenant/:tenantId/*` routes |
| Repository | Every query binds `tenant_id` as first parameter |
| Guardrails | Reject queries embedding foreign tenant UUIDs |
| Prompt | System instructions forbid cross-tenant speculation |

Defense in depth: even if a route handler bug omitted a filter, retrieval SQL still scopes by tenant.

## Guardrail Design

Guardrails run **before** and **after** vector search:

- **Before:** Block obvious injection, cross-tenant probing, and out-of-scope inputs early (saves cost).
- **After:** Enforce minimum retrieval confidence so the LLM is not asked to hallucinate without grounding.

Context passed to the LLM is sanitized (strip pseudo-system tags, neutralize injection phrases in source text).

## Trade-offs & Extensions

| Decision | Rationale | Possible upgrade |
|----------|-----------|------------------|
| pgvector in Postgres | Single datastore, simpler ops | Dedicated Qdrant for scale |
| Cosine similarity | Standard for normalized embeddings | Hybrid BM25 + vector |
| Sync ingestion | Assignment scope | Background job queue (BullMQ) |
| Pattern-based guardrails | Fast, explainable | LLM classifier moderation layer |
| No auth (baseline) | Fast evaluation | JWT + tenant claim binding |

## Operational Notes

- Run migrations on startup (`migrate()` in `index.ts`).
- Set `OPENAI_API_KEY` in production; use `MOCK_LLM=true` only for local demos.
- Tune `RETRIEVAL_MIN_SCORE` per corpus quality (dense legal text may need lower threshold).
