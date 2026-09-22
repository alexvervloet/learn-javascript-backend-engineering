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

// The placeholder that ships in .env.example and docker-compose.yml. It exists so
// the app starts on a fresh clone; it must never survive to a deployment.
const PLACEHOLDER_SECRET = "change-me-to-a-long-random-string";

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
function assertProductionSecret(jwtSecret: string, environment: string): void {
  const isProduction = environment === "production" || process.env.NODE_ENV === "production";
  if (!isProduction) return;

  if (jwtSecret === PLACEHOLDER_SECRET) {
    throw new Error(
      "JWT_SECRET is still the example placeholder and ENVIRONMENT is production. " +
        "Generate one with: node -e \"console.log(require('node:crypto').randomBytes(32).toString('hex'))\""
    );
  }
  if (jwtSecret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters in production (got ${jwtSecret.length}). ` +
        "Generate one with: node -e \"console.log(require('node:crypto').randomBytes(32).toString('hex'))\""
    );
  }
}

interface Settings {
  databaseUrl: string;
  baseUrl: string;
  redisUrl: string;
  cacheTtl: number;
  jwtSecret: string;
  jwtAlgorithm: Algorithm;
  jwtExpiryMinutes: number;
  environment: string;
}

function getSettings(): Settings {
  const jwtSecret = process.env.JWT_SECRET || PLACEHOLDER_SECRET;
  const environment = process.env.ENVIRONMENT || "development";
  assertProductionSecret(jwtSecret, environment);

  return {
    databaseUrl: process.env.DATABASE_URL || "file:./dev.db",
    baseUrl: process.env.BASE_URL || "http://localhost:8000",
    redisUrl: process.env.REDIS_URL || "redis://localhost:6379/0",
    cacheTtl: Number(process.env.CACHE_TTL || 300),
    jwtSecret,
    jwtAlgorithm: jwtAlgorithm(),
    jwtExpiryMinutes: Number(process.env.JWT_EXPIRY_MINUTES || 30),
    environment,
  };
}

export { getSettings };
export type { Settings };
