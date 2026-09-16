// Auth routes

import express from "express";

import prisma from "../database.js";
import {
  getCurrentToken,
  getCurrentUser,
  currentToken,
  currentUser,
  blocklistKey,
} from "../dependencies.js";
import { HttpError, asyncHandler } from "../exceptions.js";
import { limit } from "../rate_limit.js";
import { getRedis } from "../redis_client.js";
import { makeLogger } from "../logging_config.js";
import { validateBody, validatedBody } from "../validate.js";
import { userCreate } from "../schemas/user.js";
import { userPublic, tokenResponse } from "../schemas/serializers.js";
import {
  createAccessToken,
  hashPassword,
  verifyPassword,
} from "../security.js";

const router = express.Router();
const logger = makeLogger("app.routers.auth");

router.post(
  "/register",
  limit(5),
  validateBody(userCreate),
  asyncHandler(async (req, res) => {
    const { email, username, password } = validatedBody(req, userCreate);

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });
    if (existing) {
      throw new HttpError(400, "A user with that email or username already exists");
    }

    const user = await prisma.user.create({
      data: { email, username, passwordHash: hashPassword(password) },
    });
    logger.info(`Registered new user: ${user.username}`);
    res.status(201).json(userPublic(user));
  })
);

// OAuth2 password flow: the token endpoint reads form-encoded username/password.
router.post(
  "/token",
  limit(10),
  asyncHandler(async (req, res) => {
    // This route deliberately skips validateBody, so the body is whatever the
    // client sent. Reading it as optional fields keeps that honest.
    const body: unknown = req.body ?? {};
    const { username, password } = body as { username?: string; password?: string };
    const credentialsError = new HttpError(401, "Incorrect username or password", {
      "WWW-Authenticate": "Bearer",
    });
    if (!username) {
      logger.warning("Failed login attempt with no username");
      throw credentialsError;
    }
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !verifyPassword(password || "", user.passwordHash)) {
      logger.warning(`Failed login attempt for username: ${username}`);
      throw credentialsError;
    }
    if (!user.isActive) {
      throw new HttpError(400, "Inactive user");
    }

    const token = createAccessToken(user.username);
    logger.info(`Issued token for user: ${user.username}`);
    res.json(tokenResponse(token));
  })
);

// Revoke the caller's token by adding its jti to the Redis blocklist.
router.post(
  "/logout",
  getCurrentToken,
  asyncHandler(async (req, res) => {
    const payload = currentToken(req);
    const remaining = Math.floor((payload.exp.getTime() - Date.now()) / 1000);
    if (remaining > 0) {
      await getRedis().setex(blocklistKey(payload.jti), remaining, "1");
    }
    logger.info(`User ${payload.sub} logged out (jti=${payload.jti})`);
    res.status(204).end();
  })
);

router.get(
  "/me",
  getCurrentUser,
  asyncHandler(async (req, res) => {
    res.json(userPublic(currentUser(req)));
  })
);

export default router;
