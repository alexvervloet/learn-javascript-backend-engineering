// HTTP error type + centralized error handling. Provides an HttpError class and
// an async wrapper so thrown/rejected errors reach the error middleware.

import type { ErrorRequestHandler, NextFunction, RequestHandler, Response } from "express";

import type { AppRequest } from "./request.js";

type ErrorHeaders = Record<string, string>;

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

// Prisma signals a unique-constraint violation with code "P2002". The thrown
// value is `unknown`, so this narrows it instead of reaching for err.code.
function isPrismaErrorWithCode(err: unknown, code: string): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === code
  );
}

// Wrap an async handler so rejected promises reach the error middleware.
// The callback receives an AppRequest rather than a bare Request, which is what
// lets handlers reach for req.user and req.validated. AppRequest only adds
// optional fields to Request, so widening at the boundary is sound.
function asyncHandler(
  fn: (req: AppRequest, res: Response, next: NextFunction) => unknown
): RequestHandler {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// Express error middleware — register last. Maps HttpError and Prisma
// unique-constraint violations (P2002); everything else is a 500.
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    if (err.headers) res.set(err.headers);
    res.status(err.statusCode).json({ detail: err.detail });
    return;
  }
  if (isPrismaErrorWithCode(err, "P2002")) {
    res.status(409).json({ detail: "Resource already exists" });
    return;
  }
  res.status(500).json({ detail: "Internal server error" });
};

export { HttpError, asyncHandler, errorHandler, isPrismaErrorWithCode };
export type { ErrorHeaders };
