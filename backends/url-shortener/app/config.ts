// Application settings, read from the environment with defaults.

import type { Algorithm } from "jsonwebtoken";

// jsonwebtoken accepts only its own Algorithm union, not any string, so the
// env var is narrowed once here rather than cast at each signing site.
const JWT_ALGORITHMS: Algorithm[] = ["HS256", "HS384", "HS512"];

function jwtAlgorithm(): Algorithm {
  const configured = process.env.JWT_ALGORITHM;
  const match = JWT_ALGORITHMS.find((alg) => alg === configured);
  return match ?? "HS256";
}

interface Settings {
  databaseUrl: string;
  baseUrl: string;
  redisUrl: string;
  cacheTtl: number;
  jwtSecret: string;
  jwtAlgorithm: Algorithm;
  jwtExpiryMinutes: number;
}

function getSettings(): Settings {
  return {
    databaseUrl: process.env.DATABASE_URL || "file:./dev.db",
    baseUrl: process.env.BASE_URL || "http://localhost:8000",
    redisUrl: process.env.REDIS_URL || "redis://localhost:6379/0",
    cacheTtl: Number(process.env.CACHE_TTL || 300),
    jwtSecret: process.env.JWT_SECRET || "change-me-to-a-long-random-string",
    jwtAlgorithm: jwtAlgorithm(),
    jwtExpiryMinutes: Number(process.env.JWT_EXPIRY_MINUTES || 30),
  };
}

export { getSettings };
export type { Settings };
