import pg from "pg";
import pgvector from "pgvector/pg";
import { config } from "../config.js";

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
});

export async function withClient<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await pgvector.registerTypes(client);
    return await fn(client);
  } finally {
    client.release();
  }
}
