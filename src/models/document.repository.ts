import pgvector from "pgvector/pg";
import { withClient } from "../db/pool.js";
import type { DocumentRecord, RetrievedChunk } from "./types.js";

function mapDocument(row: Record<string, unknown>): DocumentRecord {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    filename: row.filename as string,
    mimeType: row.mime_type as string,
    status: row.status as DocumentRecord["status"],
    chunkCount: row.chunk_count as number,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

export async function createDocument(
  id: string,
  tenantId: string,
  filename: string,
  mimeType: string
): Promise<DocumentRecord> {
  const { rows } = await withClient(async (client) => {
    return client.query(
      `INSERT INTO documents (id, tenant_id, filename, mime_type, status)
       VALUES ($1, $2, $3, $4, 'processing') RETURNING *`,
      [id, tenantId, filename, mimeType]
    );
  });
  return mapDocument(rows[0]);
}

export async function updateDocumentStatus(
  documentId: string,
  tenantId: string,
  status: DocumentRecord["status"],
  chunkCount: number
): Promise<void> {
  await withClient(async (client) => {
    await client.query(
      `UPDATE documents SET status = $1, chunk_count = $2, updated_at = NOW()
       WHERE id = $3 AND tenant_id = $4`,
      [status, chunkCount, documentId, tenantId]
    );
  });
}

export async function listDocuments(tenantId: string): Promise<DocumentRecord[]> {
  const { rows } = await withClient(async (client) => {
    return client.query(
      `SELECT * FROM documents WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId]
    );
  });
  return rows.map(mapDocument);
}

export async function getDocument(
  documentId: string,
  tenantId: string
): Promise<DocumentRecord | null> {
  const { rows } = await withClient(async (client) => {
    return client.query(`SELECT * FROM documents WHERE id = $1 AND tenant_id = $2`, [
      documentId,
      tenantId,
    ]);
  });
  return rows[0] ? mapDocument(rows[0]) : null;
}

export async function deleteDocument(documentId: string, tenantId: string): Promise<boolean> {
  const { rowCount } = await withClient(async (client) => {
    return client.query(`DELETE FROM documents WHERE id = $1 AND tenant_id = $2`, [
      documentId,
      tenantId,
    ]);
  });
  return (rowCount ?? 0) > 0;
}

export async function insertChunks(
  tenantId: string,
  documentId: string,
  chunks: Array<{ id: string; index: number; content: string; embedding: number[] }>
): Promise<void> {
  await withClient(async (client) => {
    for (const chunk of chunks) {
      const embeddingSql = pgvector.toSql(chunk.embedding);
      await client.query(
        `INSERT INTO document_chunks (id, tenant_id, document_id, chunk_index, content, embedding)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [chunk.id, tenantId, documentId, chunk.index, chunk.content, embeddingSql]
      );
    }
  });
}

export async function searchChunks(
  tenantId: string,
  queryEmbedding: number[],
  topK: number
): Promise<RetrievedChunk[]> {
  const embeddingSql = pgvector.toSql(queryEmbedding);
  const { rows } = await withClient(async (client) => {
    return client.query(
      `SELECT c.id, c.tenant_id, c.document_id, c.chunk_index, c.content,
              d.filename,
              1 - (c.embedding <=> $2::vector) AS score
       FROM document_chunks c
       JOIN documents d ON d.id = c.document_id AND d.tenant_id = c.tenant_id
       WHERE c.tenant_id = $1 AND d.status = 'ready'
       ORDER BY c.embedding <=> $2::vector
       LIMIT $3`,
      [tenantId, embeddingSql, topK]
    );
  });

  return rows.map((row) => ({
    id: row.id as string,
    tenantId: row.tenant_id as string,
    documentId: row.document_id as string,
    chunkIndex: row.chunk_index as number,
    content: row.content as string,
    filename: row.filename as string,
    score: parseFloat(row.score as string),
  }));
}

export async function countChunksForTenant(tenantId: string): Promise<number> {
  const { rows } = await withClient(async (client) => {
    return client.query(`SELECT COUNT(*)::int AS count FROM document_chunks WHERE tenant_id = $1`, [
      tenantId,
    ]);
  });
  return rows[0].count as number;
}
