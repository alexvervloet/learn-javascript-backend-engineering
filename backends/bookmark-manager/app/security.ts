// Password hashing and JWT helpers.

import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { getSettings } from "./config.js";

// What decodeAccessToken hands back once it has checked the claims it needs.
interface TokenPayload {
  sub: string;
  jti: string;
  exp: Date;
}

function hashPassword(password: string): string {
  return bcrypt.hashSync(password, bcrypt.genSaltSync());
}

function verifyPassword(plain: string, hashed: string): boolean {
  return bcrypt.compareSync(plain, hashed);
}

function createAccessToken(subject: string, expiresMinutes: number | null = null): string {
  const settings = getSettings();
  const minutes = expiresMinutes || settings.accessTokenExpireMinutes;
  return jwt.sign(
    { sub: subject, jti: crypto.randomUUID() },
    settings.secretKey,
    { algorithm: settings.algorithm, expiresIn: `${minutes}m` }
  );
}

// Returns { sub, jti, exp } on success or null on any failure (invalid
// signature, expired, malformed).
function decodeAccessToken(token: string): TokenPayload | null {
  const settings = getSettings();
  try {
    const payload = jwt.verify(token, settings.secretKey, {
      algorithms: [settings.algorithm],
    });
    // jwt.verify can hand back a bare string payload, which carries no claims.
    if (typeof payload === "string") {
      return null;
    }
    if (!payload.sub || !payload.jti || !payload.exp) {
      return null;
    }
    return {
      sub: String(payload.sub),
      jti: String(payload.jti),
      exp: new Date(payload.exp * 1000),
    };
  } catch {
    return null;
  }
}

export {
  hashPassword,
  verifyPassword,
  createAccessToken,
  decodeAccessToken,
};
export type { TokenPayload };
