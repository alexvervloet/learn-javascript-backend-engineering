// A single shared Prisma client. Every handler shares this one connection pool,
// which is the idiomatic Prisma pattern.

import { PrismaClient } from "./generated/prisma/index.js";

const prisma = new PrismaClient();

export default prisma;
