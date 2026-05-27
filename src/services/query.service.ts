import { config } from "../config.js";
import * as docRepo from "../models/document.repository.js";
import type { QueryResult } from "../models/types.js";
import { embedQuery } from "../rag/embeddings.js";
import {
  checkQueryGuardrails,
  filterChunksByConfidence,
} from "../rag/guardrails.js";
import { generateAnswer } from "../rag/generator.js";

export async function queryTenantKnowledge(
  tenantId: string,
  question: string
): Promise<QueryResult> {
  const embedding = await embedQuery(question);
  const rawChunks = await docRepo.searchChunks(tenantId, embedding, config.retrievalTopK);

  const guardrail = checkQueryGuardrails(question, tenantId, rawChunks);
  if (!guardrail.allowed) {
    return {
      answer: guardrail.reason,
      sources: [],
      guardrail: guardrail.code,
      confidence: "blocked",
    };
  }

  const chunks = filterChunksByConfidence(rawChunks);
  const topScore = chunks[0]?.score ?? 0;
  const confidence =
    topScore >= 0.65 ? "high" : topScore >= config.retrievalMinScore ? "medium" : "low";

  const answer = await generateAnswer(question, chunks);

  return {
    answer,
    sources: chunks.map((c) => ({
      documentId: c.documentId,
      filename: c.filename,
      chunkIndex: c.chunkIndex,
      excerpt: c.content.slice(0, 280),
      score: Math.round(c.score * 1000) / 1000,
    })),
    confidence,
  };
}
