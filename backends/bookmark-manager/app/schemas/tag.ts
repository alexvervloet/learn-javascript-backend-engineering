// Zod schema for tags

import { z } from "zod";

const tagCreate = z.object({
  name: z.string().min(1).max(50),
});

type TagCreate = z.infer<typeof tagCreate>;

export { tagCreate };
export type { TagCreate };
