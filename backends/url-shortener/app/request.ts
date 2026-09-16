// Helpers for reading path and query parameters.
//
// Express 5 types both as `string | string[]`, and it is right to: a client can
// send ?page=1&page=2, and a route pattern can bind the same name twice. Every
// route here binds each name once and wants a single value, so these two
// helpers say that in one place rather than at every read.

import type { Request } from "express";

function pathParam(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function queryParam(req: Request, name: string, fallback: string): string {
  const value = req.query[name];
  return typeof value === "string" ? value : fallback;
}

export { pathParam, queryParam };
