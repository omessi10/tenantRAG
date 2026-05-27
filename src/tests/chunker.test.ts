import { describe, expect, it } from "vitest";
import { chunkText } from "../rag/chunker.js";

describe("chunkText", () => {
  it("returns empty array for empty input", () => {
    expect(chunkText("   ")).toEqual([]);
  });

  it("splits long text into multiple chunks", () => {
    const text = "word ".repeat(500).trim();
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((c) => expect(c.length).toBeLessThanOrEqual(900));
  });

  it("preserves short text as single chunk", () => {
    const text = "Short policy about refunds within 30 days.";
    expect(chunkText(text)).toEqual([text]);
  });
});
