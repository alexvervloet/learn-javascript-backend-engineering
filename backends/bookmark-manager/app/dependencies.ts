// Auth middleware. `getCurrentToken` validates the bearer token (and checks the
// Redis blocklist); `getCurrentUser` additionally loads the User row.

import type { Request, RequestHandler } from "express";

import type { AppRequest } from "./request.js";

import prisma from "./database.js";
import { HttpError, asyncHandler } from "./exceptions.js";
import { getRedis } from "./redis_client.js";
import { decodeAccessToken } from "./security.js";
import type { TokenPayload } from "./security.js";
import type { User } from "./generated/prisma/index.js";

const BLOCKLIST_KEY_PREFIX = "blocklist:";

function blocklistKey(jti: string): string {
  return `${BLOCKLIST_KEY_PREFIX}${jti}`;
}

function bearerToken(req: Request): string | null {
  const header = req.get("authorization") || "";
  const [scheme, value] = header.split(" ");
  return scheme === "Bearer" && value ? value : null;
}

const credentialsError = (): HttpError =>
  new HttpError(401, "Could not validate credentials", {
    "WWW-Authenticate": "Bearer",
  });

// Populates req.tokenPayload with { sub, jti, exp }.
const getCurrentToken: RequestHandler = asyncHandler(async (req, _res, next) => {
  const token = bearerToken(req);
  const payload = token ? decodeAccessToken(token) : null;
  if (!payload) throw credentialsError();
  if (await getRedis().exists(blocklistKey(payload.jti))) throw credentialsError();
  req.tokenPayload = payload;
  next();
});

// Reads what getCurrentToken stored. Throws the same 401 the middleware would
// have, so a route that forgot the middleware fails loudly instead of silently.
function currentToken(req: AppRequest): TokenPayload {
  const payload = req.tokenPayload;
  if (!payload) throw credentialsError();
  return payload;
}

// Populates req.user with the active User row. Chains after getCurrentToken.
const getCurrentUser: RequestHandler[] = [
  getCurrentToken,
  asyncHandler(async (req, _res, next) => {
    const user = await prisma.user.findUnique({
      where: { username: currentToken(req).sub },
    });
    if (!user) throw credentialsError();
    if (!user.isActive) throw new HttpError(400, "Inactive user");
    req.user = user;
    next();
  }),
];

// Reads what getCurrentUser stored, with the same loud failure as currentToken.
function currentUser(req: AppRequest): User {
  const user = req.user;
  if (!user) throw credentialsError();
  return user;
}

export { getCurrentToken, getCurrentUser, currentToken, currentUser, blocklistKey };
