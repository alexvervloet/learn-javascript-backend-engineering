// The request type this app's middleware produces, plus helpers for reading
// path and query parameters.
//
// Express's own Request knows nothing about `user` or `validated`. The usual fix
// is `declare global { namespace Express { interface Request ... } }`, but a
// global augmentation is global: this repo holds two Express apps whose `user`
// is a different row type, and merging both into one global makes them collide.
// Declaring the extra fields on an app-local interface keeps each app's request
// shape to itself.
//
// Both fields are optional, because a request that skipped the middleware really
// does not have them. currentUser() and validatedBody() turn that back into a
// guarantee on the routes that ran it.

import type { Request } from "express";

import type { User } from "./generated/prisma/index.js";

interface AppRequest extends Request {
  // Set by getCurrentUser. Read it through currentUser(req).
  user?: User;
  // Set by validateBody. The shape depends on which schema ran, so it stays
  // unknown here and validatedBody(req, schema) recovers the type.
  validated?: unknown;
}

// Express 5 types path and query params as `string | string[]`, and it is right
// to: a client can send ?page=1&page=2, and a route pattern can bind the same
// name twice. Every route here binds each name once and wants a single value.
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
export type { AppRequest };
