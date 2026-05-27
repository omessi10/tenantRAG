import { z } from "zod";

export const createTenantSchema = z.object({
  name: z.string().min(2).max(120),
});

export const querySchema = z.object({
  question: z.string().min(3).max(2000),
});

export type CreateTenantBody = z.infer<typeof createTenantSchema>;
export type QueryBody = z.infer<typeof querySchema>;
