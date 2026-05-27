import { pool } from "../db/pool.js";
import type { Tenant } from "./types.js";

function mapTenant(row: Record<string, unknown>): Tenant {
  return {
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    createdAt: row.created_at as Date,
  };
}

export async function createTenant(id: string, name: string, slug: string): Promise<Tenant> {
  const { rows } = await pool.query(
    `INSERT INTO tenants (id, name, slug) VALUES ($1, $2, $3) RETURNING *`,
    [id, name, slug]
  );
  return mapTenant(rows[0]);
}

export async function getTenantById(id: string): Promise<Tenant | null> {
  const { rows } = await pool.query(`SELECT * FROM tenants WHERE id = $1`, [id]);
  return rows[0] ? mapTenant(rows[0]) : null;
}

export async function tenantExists(id: string): Promise<boolean> {
  const { rows } = await pool.query(`SELECT 1 FROM tenants WHERE id = $1`, [id]);
  return rows.length > 0;
}
