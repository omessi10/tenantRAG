export interface Tenant {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
}

export interface DocumentRecord {
  id: string;
  tenantId: string;
  filename: string;
  mimeType: string;
  status: "processing" | "ready" | "failed";
  chunkCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChunkRecord {
  id: string;
  tenantId: string;
  documentId: string;
  chunkIndex: number;
  content: string;
}

export interface RetrievedChunk extends ChunkRecord {
  filename: string;
  score: number;
}

export interface QueryResult {
  answer: string;
  sources: Array<{
    documentId: string;
    filename: string;
    chunkIndex: number;
    excerpt: string;
    score: number;
  }>;
  guardrail?: string;
  confidence: "high" | "medium" | "low" | "blocked";
}
