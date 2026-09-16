// HTTP error type + centralized error handling.

import type { ErrorRequestHandler, NextFunction, RequestHandler, Response } from "express";

import type { AppRequest } from "./request.js";

import { makeLogger } from "./logging_config.js";

const logger = makeLogger("app.exceptions");

type ErrorHeaders = Record<string, string>;

// Raised inside handlers to short-circuit with a status code and detail.
// `headers` lets auth routes set WWW-Authenticate.
class HttpError extends Error {
  statusCode: number;
  detail: string;
  headers: ErrorHeaders | null;

  constructor(statusCode: number, detail: string, headers: ErrorHeaders | null = null) {
    super(detail);
    this.statusCode = statusCode;
    this.detail = detail;
    this.headers = headers;
  }
}

// Prisma reports a unique-constraint violation as code "P2002". A caught value
// is `unknown` in TypeScript, so the shape is checked rather than assumed.
function isPrismaErrorWithCode(err: unknown, code: string): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === code
  );
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.stack ?? err.message;
  return String(err);
}

// Wrap an async handler so thrown errors reach the error middleware (Express 4
// doesn't forward rejected promises automatically).
// The callback receives an AppRequest rather than a bare Request, which is what
// lets handlers reach for req.user, req.tokenPayload and req.validated.
// AppRequest only adds optional fields to Request, so widening here is sound.
function asyncHandler(
  fn: (req: AppRequest, res: Response, next: NextFunction) => unknown
): RequestHandler {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// Express error middleware — must be registered last. Maps HttpError, Prisma
// unique-constraint violations (P2002 → 409), and everything else (500).
const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) {
    if (err.headers) res.set(err.headers);
    res.status(err.statusCode).json({ detail: err.detail });
    return;
  }

  if (isPrismaErrorWithCode(err, "P2002")) {
    logger.warning(`DB integrity error on ${req.path}: ${errorMessage(err)}`);
    res.status(409).json({
      detail: "Database integrity error (likely a uniqueness conflict)",
    });
    return;
  }

  logger.error(`Unhandled exception on ${req.path}: ${errorMessage(err)}`);
  res.status(500).json({ detail: "Internal server error" });
};

export { HttpError, asyncHandler, errorHandler, isPrismaErrorWithCode };
export type { ErrorHeaders };
