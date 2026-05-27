import { v4 as uuidv4 } from "uuid";
import * as tenantRepo from "../models/tenant.repository.js";
import type { Tenant } from "../models/types.js";

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `${base}-${uuidv4().slice(0, 8)}`;
}

export async function createTenant(name: string): Promise<Tenant> {
  const id = uuidv4();
  const slug = slugify(name);
  return tenantRepo.createTenant(id, name, slug);
}

export async function getTenant(id: string): Promise<Tenant | null> {
  return tenantRepo.getTenantById(id);
}
