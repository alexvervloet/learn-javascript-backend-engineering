// Zod schemas for categories

import { z } from "zod";

const categoryCreate = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullish(),
});

const categoryUpdate = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullish(),
});

type CategoryCreate = z.infer<typeof categoryCreate>;
type CategoryUpdate = z.infer<typeof categoryUpdate>;

export { categoryCreate, categoryUpdate };
export type { CategoryCreate, CategoryUpdate };
