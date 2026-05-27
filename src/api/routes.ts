import type { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import * as docRepo from "../models/document.repository.js";
import { assertTenantConsistency, requireTenant } from "../middleware/tenant-scope.js";
import * as documentService from "../services/document.service.js";
import * as queryService from "../services/query.service.js";
import * as tenantService from "../services/tenant.service.js";
import { createTenantSchema, querySchema } from "./schemas.js";

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(multipart, {
    limits: { fileSize: 15 * 1024 * 1024 },
  });

  app.get("/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }));

  app.post("/tenant", async (request, reply) => {
    const parsed = createTenantSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const tenant = await tenantService.createTenant(parsed.data.name);
    return reply.status(201).send(tenant);
  });

  app.get<{ Params: { id: string } }>(
    "/tenant/:id",
    { preHandler: requireTenant },
    async (request) => {
      const tenant = await tenantService.getTenant(request.params.id);
      return tenant;
    }
  );

  app.post<{ Params: { tenantId: string } }>(
    "/tenant/:tenantId/documents",
    { preHandler: requireTenant },
    async (request, reply) => {
      assertTenantConsistency(request, reply);
      if (reply.sent) return;

      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: "File is required (multipart field: file)" });
      }

      const buffer = await data.toBuffer();
      const filename = data.filename ?? "upload.txt";
      const mimeType = data.mimetype ?? "application/octet-stream";

      try {
        const doc = await documentService.ingestDocument(
          request.params.tenantId,
          filename,
          mimeType,
          buffer
        );
        return reply.status(201).send(doc);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        return reply.status(400).send({ error: message });
      }
    }
  );

  app.get<{ Params: { tenantId: string } }>(
    "/tenant/:tenantId/documents",
    { preHandler: requireTenant },
    async (request) => {
      const docs = await docRepo.listDocuments(request.params.tenantId);
      return { documents: docs };
    }
  );

  app.delete<{ Params: { tenantId: string; documentId: string } }>(
    "/tenant/:tenantId/documents/:documentId",
    { preHandler: requireTenant },
    async (request, reply) => {
      const deleted = await docRepo.deleteDocument(
        request.params.documentId,
        request.params.tenantId
      );
      if (!deleted) {
        return reply.status(404).send({ error: "Document not found" });
      }
      return reply.status(204).send();
    }
  );

  app.post<{ Params: { tenantId: string } }>(
    "/tenant/:tenantId/query",
    { preHandler: requireTenant },
    async (request, reply) => {
      assertTenantConsistency(request, reply);
      if (reply.sent) return;

      const parsed = querySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      const result = await queryService.queryTenantKnowledge(
        request.params.tenantId,
        parsed.data.question
      );
      return result;
    }
  );
}
