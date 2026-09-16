// Auth routes

import express from "express";

import prisma from "../database.js";
import {
  createAccessToken,
  currentUser,
  getCurrentUser,
  hashPassword,
  verifyPassword,
} from "../auth.js";
import { HttpError, asyncHandler, isPrismaErrorWithCode } from "../errors.js";
import { validateBody, validatedBody } from "../validate.js";
import {
  registerRequest,
  tokenResponse,
  userResponse,
} from "../schemas.js";

const router = express.Router();

router.post(
  "/register",
  validateBody(registerRequest),
  asyncHandler(async (req, res) => {
    const { username, password } = validatedBody(req, registerRequest);
    try {
      await prisma.user.create({
        data: { username, hashedPassword: hashPassword(password) },
      });
    } catch (err) {
      if (isPrismaErrorWithCode(err, "P2002")) {
        throw new HttpError(409, "Username already taken");
      }
      throw err;
    }
    res.status(201).json(tokenResponse(createAccessToken(username)));
  })
);

// OAuth2 password flow: reads form-encoded username/password.
router.post(
  "/token",
  asyncHandler(async (req, res) => {
    // This route deliberately skips validateBody, so the body is whatever the
    // client sent. Reading it as unknown fields keeps that honest.
    const body: unknown = req.body ?? {};
    const { username, password } = body as { username?: string; password?: string };
    if (!username) {
      throw new HttpError(401, "Incorrect username or password", {
        "WWW-Authenticate": "Bearer",
      });
    }
    const user = await prisma.user.findFirst({
      where: { username, isActive: true },
    });
    if (!user || !verifyPassword(password || "", user.hashedPassword)) {
      throw new HttpError(401, "Incorrect username or password", {
        "WWW-Authenticate": "Bearer",
      });
    }
    res.json(tokenResponse(createAccessToken(user.username)));
  })
);

router.get(
  "/me",
  getCurrentUser,
  asyncHandler(async (req, res) => {
    res.json(userResponse(currentUser(req)));
  })
);

export default router;
