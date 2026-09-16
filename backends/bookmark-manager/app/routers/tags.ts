// Tag routes

import express from "express";

import prisma from "../database.js";
import { getCurrentUser, currentUser } from "../dependencies.js";
import { HttpError, asyncHandler } from "../exceptions.js";
import { makeLogger } from "../logging_config.js";
import { validateBody, validatedBody } from "../validate.js";
import { pathParamInt } from "../request.js";
import { tagCreate } from "../schemas/tag.js";
import { tagPublic } from "../schemas/serializers.js";

const router = express.Router();
const logger = makeLogger("app.routers.tags");

router.post(
  "/",
  getCurrentUser,
  validateBody(tagCreate),
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const { name } = validatedBody(req, tagCreate);
    const existing = await prisma.tag.findFirst({
      where: { name, userId: user.id },
    });
    if (existing) {
      // Idempotent: return the existing tag rather than erroring.
      return res.status(201).json(tagPublic(existing));
    }
    const tag = await prisma.tag.create({
      data: { name, userId: user.id },
    });
    res.status(201).json(tagPublic(tag));
  })
);

router.get(
  "/",
  getCurrentUser,
  asyncHandler(async (req, res) => {
    const tags = await prisma.tag.findMany({
      where: { userId: currentUser(req).id },
      orderBy: { name: "asc" },
    });
    res.json(tags.map(tagPublic));
  })
);

router.delete(
  "/:tagId",
  getCurrentUser,
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const id = pathParamInt(req, "tagId");
    const tag = await prisma.tag.findUnique({ where: { id } });
    if (!tag || tag.userId !== user.id) {
      throw new HttpError(404, "Tag not found");
    }
    await prisma.tag.delete({ where: { id } });
    logger.info(`User ${user.username} deleted tag ${id}`);
    res.status(204).end();
  })
);

export default router;
