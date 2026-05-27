import { pool } from "./pool.js";

const MIGRATION_SQL = `
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  chunk_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_tenant ON documents(tenant_id);

CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chunks_tenant ON document_chunks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chunks_document ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON document_chunks
  USING hnsw (embedding vector_cosine_ops);
`;

export async function migrate(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(MIGRATION_SQL);
    console.log("Database migration completed.");
  } finally {
    client.release();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  migrate()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
