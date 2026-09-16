// Minimal structured-ish logger. Node has no stdlib logging module, so we expose
// a tiny console wrapper with a "timestamp | LEVEL | message" shape and a level
// threshold.

import { getSettings } from "./config.js";
import type { LogLevel } from "./config.js";

// Record<LogLevel, number> ties the table to the LogLevel union: add a level to
// one and the other stops compiling until it catches up.
const LEVELS: Record<LogLevel, number> = { DEBUG: 10, INFO: 20, WARNING: 30, ERROR: 40 };

type LogFn = (msg: string, ...args: unknown[]) => void;

interface Logger {
  info: LogFn;
  warning: LogFn;
  error: LogFn;
}

function timestamp(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function makeLogger(name: string): Logger {
  const threshold = LEVELS[getSettings().logLevel];

  function emit(
    level: LogLevel,
    stream: (message: string) => void,
    message: string,
    ...args: unknown[]
  ): void {
    if (LEVELS[level] < threshold) return;
    const line = `${timestamp()} | ${level.padEnd(8)} | ${name} | ${message}`;
    stream(args.length ? `${line} ${args.map(String).join(" ")}` : line);
  }

  return {
    info: (msg, ...a) => emit("INFO", console.log, msg, ...a),
    warning: (msg, ...a) => emit("WARNING", console.warn, msg, ...a),
    error: (msg, ...a) => emit("ERROR", console.error, msg, ...a),
  };
}

export { makeLogger };
export type { Logger, LogFn };
