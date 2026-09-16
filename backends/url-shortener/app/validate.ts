// Request-body validation middleware — feeds the body through a Zod schema and
// returns 422 with the issues on failure.

import type { Request, RequestHandler } from "express";
import type { ZodType, infer as ZodInfer } from "zod";

function validateBody(schema: ZodType): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      res.status(422).json({ detail: result.error.issues });
      return;
    }
    req.validated = result.data;
    next();
  };
}

// Reads back what validateBody stored, typed by the schema.
//
// The link between the schema a route validates with and the schema a handler
// reads back is the one thing the compiler cannot check, so the assertion lives
// here, once, instead of at every handler. Pass the same schema to both.
function validatedBody<T extends ZodType>(req: Request, _schema: T): ZodInfer<T> {
  return req.validated as ZodInfer<T>;
}

export { validateBody, validatedBody };
