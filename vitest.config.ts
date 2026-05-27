import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    env: {
      MOCK_LLM: "false",
      OPENAI_API_KEY: "test-key-for-unit-tests",
      RETRIEVAL_MIN_SCORE: "0.35",
    },
  },
});
