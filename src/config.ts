import "dotenv/config";

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: parseInt(process.env.PORT ?? "3000", 10),
  databaseUrl: requireEnv("DATABASE_URL", "postgres://rag:rag_secret@localhost:5432/rag_db"),
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  embeddingModel: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
  chatModel: process.env.CHAT_MODEL ?? "gpt-4o-mini",
  embeddingDimensions: parseInt(process.env.EMBEDDING_DIMENSIONS ?? "1536", 10),
  retrievalMinScore: parseFloat(
    process.env.RETRIEVAL_MIN_SCORE ??
      (process.env.MOCK_LLM === "true" || !process.env.OPENAI_API_KEY ? "0.0" : "0.35")
  ),
  retrievalTopK: parseInt(process.env.RETRIEVAL_TOP_K ?? "5", 10),
  mockLlm: process.env.MOCK_LLM === "true" || !process.env.OPENAI_API_KEY,
  chunkSize: 800,
  chunkOverlap: 120,
};
