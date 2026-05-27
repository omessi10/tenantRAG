import OpenAI from "openai";
import { createHash } from "crypto";
import { config } from "../config.js";

let openai: OpenAI | null = null;

function getClient(): OpenAI {
  if (!openai) {
    if (!config.openaiApiKey && !config.mockLlm) {
      throw new Error("OPENAI_API_KEY is required unless MOCK_LLM=true");
    }
    openai = new OpenAI({ apiKey: config.openaiApiKey || "mock-key" });
  }
  return openai;
}

/** Deterministic pseudo-embedding for local dev without API key */
function mockEmbedding(text: string): number[] {
  const dims = config.embeddingDimensions;
  const vector = new Array<number>(dims).fill(0);
  const hash = createHash("sha256").update(text).digest();

  for (let i = 0; i < dims; i++) {
    const byte = hash[i % hash.length];
    vector[i] = (byte / 255) * 2 - 1;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vector.map((v) => v / magnitude);
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  if (config.mockLlm) {
    return texts.map(mockEmbedding);
  }

  const client = getClient();
  const response = await client.embeddings.create({
    model: config.embeddingModel,
    input: texts,
    dimensions: config.embeddingDimensions,
  });

  return response.data
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);
}

export async function embedQuery(query: string): Promise<number[]> {
  const [embedding] = await embedTexts([query]);
  return embedding;
}
