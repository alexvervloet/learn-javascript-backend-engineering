// Express request augmentation.
//
// Two middlewares hang extra state on the request: getCurrentUser sets `user`,
// validateBody sets `validated`. Express has no idea either exists, so its
// Request interface is widened here. Both are optional because a request that
// skipped the middleware genuinely does not have them — the helpers in auth.ts
// and validate.ts are what turn "optional" back into "definitely there".

import type { User } from "./generated/prisma/index.js";

declare global {
  namespace Express {
    interface Request {
      // Set by getCurrentUser. Read it through currentUser(req).
      user?: User;
      // Set by validateBody. The shape depends on which schema ran, which a
      // single global declaration cannot express, so it stays unknown here and
      // validatedBody(req, schema) recovers the type.
      validated?: unknown;
    }
  }
}

export {};
