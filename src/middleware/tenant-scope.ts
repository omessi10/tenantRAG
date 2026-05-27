import type { FastifyReply, FastifyRequest } from "fastify";
import * as tenantRepo from "../models/tenant.repository.js";

declare module "fastify" {
  interface FastifyRequest {
    tenantId?: string;
  }
}

export async function requireTenant(
  request: FastifyRequest<{ Params: { tenantId?: string; id?: string } }>,
  reply: FastifyReply
): Promise<void> {
  const tenantId = request.params.tenantId ?? request.params.id;

  if (!tenantId) {
    return reply.status(400).send({ error: "Tenant ID is required" });
  }

  const exists = await tenantRepo.tenantExists(tenantId);
  if (!exists) {
    return reply.status(404).send({ error: "Tenant not found" });
  }

  request.tenantId = tenantId;
}

/** Ensures route param tenantId matches any tenantId in body (cross-tenant leakage guard) */
export function assertTenantConsistency(
  request: FastifyRequest<{ Params: { tenantId: string }; Body?: { tenantId?: string } }>,
  reply: FastifyReply
): void {
  const bodyTenantId = (request.body as { tenantId?: string } | undefined)?.tenantId;
  if (bodyTenantId && bodyTenantId !== request.params.tenantId) {
    reply.status(403).send({ error: "Tenant ID mismatch" });
  }
}
