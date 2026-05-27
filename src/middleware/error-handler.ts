import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";

export function errorHandler(
  error: FastifyError,
  _request: FastifyRequest,
  reply: FastifyReply
): void {
  const statusCode = error.statusCode ?? 500;
  const message =
    statusCode >= 500 ? "Internal server error" : error.message;

  reply.status(statusCode).send({
    error: message,
    ...(process.env.NODE_ENV !== "production" && statusCode >= 500
      ? { detail: error.message }
      : {}),
  });
}
