// Request schemas with Zod. The route layer parses the body with these; a
// failure becomes a 422.

import { z } from "zod";

const PostCreate = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1),
});

const PostUpdate = z.object({
  // .nullish() accepts the field being absent OR explicitly null (the route
  // only applies non-null values, so null is a no-op).
  title: z.string().min(1).max(200).nullish(),
  body: z.string().nullish(),
  published: z.boolean().nullish(),
});

type PostCreateInput = z.infer<typeof PostCreate>;
type PostUpdateInput = z.infer<typeof PostUpdate>;

export { PostCreate, PostUpdate };
export type { PostCreateInput, PostUpdateInput };
