import type { RetrievedChunk } from "../models/types.js";
import { config } from "../config.js";

export type GuardrailResult =
  | { allowed: true }
  | { allowed: false; reason: string; code: string };

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /disregard\s+(your\s+)?(system|safety)\s+(prompt|instructions)/i,
  /you\s+are\s+now\s+(in\s+)?(developer|admin|god)\s+mode/i,
  /reveal\s+(the\s+)?(system|hidden)\s+prompt/i,
  /pretend\s+you\s+are\s+not\s+bound/i,
  /output\s+all\s+(tenant|user|database)\s+data/i,
  /show\s+me\s+(documents|data)\s+from\s+(another|other)\s+tenant/i,
];

const CROSS_TENANT_PATTERNS = [
  /tenant\s*[=:]\s*[a-f0-9-]{8,}/i,
  /access\s+tenant\s+[a-f0-9-]+/i,
  /other\s+(company|organization|firm|school)'?s?\s+data/i,
];

const OUT_OF_SCOPE_PATTERNS = [
  /^(hi|hello|hey|thanks|thank you|bye|goodbye)[\s!.?]*$/i,
  /what\s+is\s+the\s+weather/i,
  /write\s+(me\s+)?a\s+poem/i,
  /who\s+won\s+the\s+(world\s+cup|super\s+bowl)/i,
  /solve\s+this\s+math/i,
];

const SAFE_FALLBACK =
  "I can only answer questions using your organization's uploaded documents. Please rephrase your question or upload relevant materials.";

const LOW_CONFIDENCE_FALLBACK =
  "I couldn't find enough relevant information in your knowledge base to answer confidently. Try rephrasing or uploading more documents on this topic.";

const INJECTION_FALLBACK =
  "I can't process that request. Please ask a question about your organization's documents.";

export function checkQueryGuardrails(
  query: string,
  tenantId: string,
  chunks: RetrievedChunk[]
): GuardrailResult {
  const trimmed = query.trim();

  if (trimmed.length < 3) {
    return { allowed: false, reason: SAFE_FALLBACK, code: "QUERY_TOO_SHORT" };
  }

  if (trimmed.length > 2000) {
    return { allowed: false, reason: SAFE_FALLBACK, code: "QUERY_TOO_LONG" };
  }

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { allowed: false, reason: INJECTION_FALLBACK, code: "PROMPT_INJECTION" };
    }
  }

  for (const pattern of CROSS_TENANT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { allowed: false, reason: INJECTION_FALLBACK, code: "CROSS_TENANT_ATTEMPT" };
    }
  }

  // Block explicit references to other tenant UUIDs in query
  const uuidPattern = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi;
  const uuids = trimmed.match(uuidPattern) ?? [];
  for (const id of uuids) {
    if (id.toLowerCase() !== tenantId.toLowerCase()) {
      return { allowed: false, reason: INJECTION_FALLBACK, code: "FOREIGN_TENANT_ID" };
    }
  }

  for (const pattern of OUT_OF_SCOPE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        allowed: false,
        reason:
          "That question appears to be outside your organization's knowledge base. Ask about your uploaded policies, FAQs, or manuals.",
        code: "OUT_OF_SCOPE",
      };
    }
  }

  if (chunks.length === 0) {
    return { allowed: false, reason: LOW_CONFIDENCE_FALLBACK, code: "NO_RETRIEVAL" };
  }

  if (config.mockLlm) {
    return { allowed: true };
  }

  const topScore = Math.max(...chunks.map((c) => c.score));
  if (topScore < config.retrievalMinScore) {
    return { allowed: false, reason: LOW_CONFIDENCE_FALLBACK, code: "LOW_CONFIDENCE" };
  }

  return { allowed: true };
}

export function filterChunksByConfidence(chunks: RetrievedChunk[]): RetrievedChunk[] {
  if (config.mockLlm) {
    return chunks;
  }
  return chunks.filter((c) => c.score >= config.retrievalMinScore);
}

export function sanitizeContext(chunks: RetrievedChunk[]): string {
  return chunks
    .map((c, i) => {
      const safeContent = c.content
        .replace(/<\/?system>/gi, "")
        .replace(/ignore\s+instructions/gi, "[filtered]");
      return `[Source ${i + 1}: ${c.filename} #${c.chunkIndex}]\n${safeContent}`;
    })
    .join("\n\n---\n\n");
}

export { SAFE_FALLBACK, LOW_CONFIDENCE_FALLBACK, INJECTION_FALLBACK };
