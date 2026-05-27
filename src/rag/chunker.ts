import { config } from "../config.js";

export function chunkText(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(start + config.chunkSize, normalized.length);

    if (end < normalized.length) {
      const slice = normalized.slice(start, end);
      const lastBreak = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("\n"));
      if (lastBreak > config.chunkSize * 0.5) {
        end = start + lastBreak + 1;
      }
    }

    const chunk = normalized.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    if (end >= normalized.length) break;
    start = Math.max(end - config.chunkOverlap, start + 1);
  }

  return chunks;
}
