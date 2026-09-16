// Request-body validation middleware. Runs the body through a Zod schema; on
// failure it returns 422 with the Zod issues.

import type { RequestHandler } from "express";

import type { AppRequest } from "./request.js";
import type { ZodType, infer as ZodInfer } from "zod";

function validateBody(schema: ZodType): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      res.status(422).json({ detail: result.error.issues });
      return;
    }
    // Express hands plain Requests to middleware; this is where the extra
    // field gets written, so this is the one place that widens the type.
    (req as AppRequest).validated = result.data;
    next();
  };
}

// Reads back what validateBody stored, typed by the schema.
//
// The link between the schema a route validates with and the schema a handler
// reads back is the one thing the compiler cannot check, so the assertion lives
// here, once, instead of at every handler. Pass the same schema to both.
function validatedBody<T extends ZodType>(req: AppRequest, _schema: T): ZodInfer<T> {
  return req.validated as ZodInfer<T>;
}

export { validateBody, validatedBody };
