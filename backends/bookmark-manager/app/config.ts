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
  return {
    databaseUrl:
      process.env.DATABASE_URL ||
      "postgresql://postgres:password@localhost:5432/bookmark_manager",
    secretKey: process.env.SECRET_KEY || "change-me-in-production",
    algorithm: algorithm(),
    accessTokenExpireMinutes: Number(process.env.ACCESS_TOKEN_EXPIRE_MINUTES || 30),
    logLevel: logLevel(),
    environment: process.env.ENVIRONMENT || "development",

    redisUrl: process.env.REDIS_URL || "redis://localhost:6379/0",
    ratelimitStorageUri: process.env.RATELIMIT_STORAGE_URI || "redis://localhost:6379/0",
    brokerUrl: process.env.BROKER_URL || "redis://localhost:6379/1",
  };
}

export { getSettings };
export type { Settings, LogLevel };
