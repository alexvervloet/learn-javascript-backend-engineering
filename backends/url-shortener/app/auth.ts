// Password hashing, JWT helpers, and the auth middleware that loads the current
// user from the bearer token.

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, RequestHandler } from "express";

import prisma from "./database.js";
import { getSettings } from "./config.js";
import { HttpError, asyncHandler } from "./errors.js";
import type { User } from "./generated/prisma/index.js";

function hashPassword(password: string): string {
  return bcrypt.hashSync(password, bcrypt.genSaltSync());
}

function verifyPassword(plain: string, hashed: string): boolean {
  return bcrypt.compareSync(plain, hashed);
}

function createAccessToken(username: string): string {
  const settings = getSettings();
  return jwt.sign({ sub: username }, settings.jwtSecret, {
    algorithm: settings.jwtAlgorithm,
    expiresIn: `${settings.jwtExpiryMinutes}m`,
  });
}

function bearerToken(req: Request): string | null {
  const header = req.get("authorization") || "";
  const [scheme, value] = header.split(" ");
  return scheme === "Bearer" && value ? value : null;
}

// Populates req.user with the active User row, or throws 401.
const getCurrentUser: RequestHandler = asyncHandler(async (req, _res, next) => {
  const settings = getSettings();
  const credentialsError = new HttpError(401, "Invalid or expired token", {
    "WWW-Authenticate": "Bearer",
  });

  const token = bearerToken(req);
  if (!token) throw credentialsError;

  let payload: jwt.JwtPayload | string;
  try {
    payload = jwt.verify(token, settings.jwtSecret, {
      algorithms: [settings.jwtAlgorithm],
    });
  } catch (err) {
    // jwt.verify rejects with several error classes; only the expiry one gets
    // its own message. `err` is unknown, hence the instanceof rather than
    // reading err.name off it directly.
    if (err instanceof jwt.TokenExpiredError) {
      throw new HttpError(401, "Token has expired", { "WWW-Authenticate": "Bearer" });
    }
    throw credentialsError;
  }

  // A token can legitimately carry a bare string payload, which has no `sub`.
  if (typeof payload === "string" || !payload.sub) throw credentialsError;

  const user = await prisma.user.findFirst({
    where: { username: payload.sub, isActive: true },
  });
  if (!user) throw credentialsError;

  req.user = user;
  next();
});

// req.user is optional on the Request type because most routes never run
// getCurrentUser. This turns it back into a guarantee for the routes that do,
// and fails loudly rather than silently if the middleware was left off.
function currentUser(req: Request): User {
  const user = req.user;
  if (!user) {
    throw new HttpError(401, "Invalid or expired token", {
      "WWW-Authenticate": "Bearer",
    });
  }
  return user;
}

export {
  hashPassword,
  verifyPassword,
  createAccessToken,
  getCurrentUser,
  currentUser,
};
