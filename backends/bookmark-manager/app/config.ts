// Application settings, read once from the environment with sensible defaults.

import type { Algorithm } from "jsonwebtoken";

// jsonwebtoken accepts only its own Algorithm union, not any string, so the env
// var is narrowed once here rather than cast at each sign/verify site.
const ALGORITHMS: Algorithm[] = ["HS256", "HS384", "HS512"];

function algorithm(): Algorithm {
  const configured = process.env.ALGORITHM;
  return ALGORITHMS.find((alg) => alg === configured) ?? "HS256";
}

type LogLevel = "DEBUG" | "INFO" | "WARNING" | "ERROR";

const LOG_LEVELS: LogLevel[] = ["DEBUG", "INFO", "WARNING", "ERROR"];

function logLevel(): LogLevel {
  const configured = process.env.LOG_LEVEL;
  return LOG_LEVELS.find((level) => level === configured) ?? "INFO";
}

// The placeholder that ships in .env.example and docker-compose.yml. It exists so
// the app starts on a fresh clone; it must never survive to a deployment.
const PLACEHOLDER_SECRET = "change-me-in-production";

// HS256 signs with the raw secret, so its strength is the secret's strength. A
// short one is brute-forceable offline: an attacker with any token from this app
// can grind candidates locally, and a hit lets them mint a token for any user.
const MIN_SECRET_LENGTH = 32;

// Fail fast rather than boot with a secret anyone can read off GitHub.
//
// A default secret is worse than no default, because nothing goes wrong. The app
// starts, signs tokens, and serves traffic exactly as it would with a real
// secret — the only difference is that anyone who has seen this repo can forge a
// token for any account. Crashing on startup is the whole point: a deployment
// that cannot start gets noticed, and one that quietly accepts forged tokens
// does not.
function assertProductionSecret(secretKey: string, environment: string): void {
  const isProduction = environment === "production" || process.env.NODE_ENV === "production";
  if (!isProduction) return;

  if (secretKey === PLACEHOLDER_SECRET) {
    throw new Error(
      "SECRET_KEY is still the example placeholder and ENVIRONMENT is production. " +
        "Generate one with: node -e \"console.log(require('node:crypto').randomBytes(32).toString('hex'))\""
    );
  }
  if (secretKey.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `SECRET_KEY must be at least ${MIN_SECRET_LENGTH} characters in production (got ${secretKey.length}). ` +
        "Generate one with: node -e \"console.log(require('node:crypto').randomBytes(32).toString('hex'))\""
    );
  }
}

interface Settings {
  databaseUrl: string;
  secretKey: string;
  algorithm: Algorithm;
  accessTokenExpireMinutes: number;
  logLevel: LogLevel;
  environment: string;
  redisUrl: string;
  ratelimitStorageUri: string;
  brokerUrl: string;
}

function getSettings(): Settings {
  const secretKey = process.env.SECRET_KEY || PLACEHOLDER_SECRET;
  const environment = process.env.ENVIRONMENT || "development";
  assertProductionSecret(secretKey, environment);

  return {
    databaseUrl:
      process.env.DATABASE_URL ||
      "postgresql://postgres:password@localhost:5432/bookmark_manager",
    secretKey,
    algorithm: algorithm(),
    accessTokenExpireMinutes: Number(process.env.ACCESS_TOKEN_EXPIRE_MINUTES || 30),
    logLevel: logLevel(),
    environment,

    redisUrl: process.env.REDIS_URL || "redis://localhost:6379/0",
    ratelimitStorageUri: process.env.RATELIMIT_STORAGE_URI || "redis://localhost:6379/0",
    brokerUrl: process.env.BROKER_URL || "redis://localhost:6379/1",
  };
}

export { getSettings };
export type { Settings, LogLevel };
