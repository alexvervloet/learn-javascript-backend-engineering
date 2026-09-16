// Zod schemas for users. Input keys stay snake_case to match the JSON the API
// accepts.

import { z } from "zod";

const userCreate = z.object({
  email: z.string().email(),
  username: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(8).max(72),
});

type UserCreate = z.infer<typeof userCreate>;

export { userCreate };
export type { UserCreate };
