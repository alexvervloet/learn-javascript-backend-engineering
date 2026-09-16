// Category routes

import express from "express";

import prisma from "../database.js";
import { getCurrentUser, currentUser } from "../dependencies.js";
import { HttpError, asyncHandler } from "../exceptions.js";
import { makeLogger } from "../logging_config.js";
import { validateBody, validatedBody } from "../validate.js";
import { pathParamInt } from "../request.js";
import { categoryCreate, categoryUpdate } from "../schemas/category.js";
import { categoryPublic } from "../schemas/serializers.js";
import type { Prisma } from "../generated/prisma/index.js";

const router = express.Router();
const logger = makeLogger("app.routers.categories");

router.post(
  "/",
  getCurrentUser,
  validateBody(categoryCreate),
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const input = validatedBody(req, categoryCreate);
    const existing = await prisma.category.findFirst({
      where: { name: input.name, userId: user.id },
    });
    if (existing) {
      throw new HttpError(400, "A category with that name already exists");
    }
    const category = await prisma.category.create({
      data: { name: input.name, description: input.description ?? null, userId: user.id },
    });
    res.status(201).json(categoryPublic(category));
  })
);

router.get(
  "/",
  getCurrentUser,
  asyncHandler(async (req, res) => {
    const categories = await prisma.category.findMany({
      where: { userId: currentUser(req).id },
      orderBy: { name: "asc" },
    });
    res.json(categories.map(categoryPublic));
  })
);

router.get(
  "/:categoryId",
  getCurrentUser,
  asyncHandler(async (req, res) => {
    const category = await prisma.category.findUnique({
      where: { id: pathParamInt(req, "categoryId") },
    });
    if (!category || category.userId !== currentUser(req).id) {
      throw new HttpError(404, "Category not found");
    }
    res.json(categoryPublic(category));
  })
);

router.patch(
  "/:categoryId",
  getCurrentUser,
  validateBody(categoryUpdate),
  asyncHandler(async (req, res) => {
    const id = pathParamInt(req, "categoryId");
    const category = await prisma.category.findUnique({ where: { id } });
    if (!category || category.userId !== currentUser(req).id) {
      throw new HttpError(404, "Category not found");
    }
    const input = validatedBody(req, categoryUpdate);
    // Typing the patch as Prisma's own update input is what makes a typo in a
    // field name a compile error instead of a silently ignored update.
    const data: Prisma.CategoryUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;

    const updated = await prisma.category.update({ where: { id }, data });
    res.json(categoryPublic(updated));
  })
);

router.delete(
  "/:categoryId",
  getCurrentUser,
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const id = pathParamInt(req, "categoryId");
    const category = await prisma.category.findUnique({ where: { id } });
    if (!category || category.userId !== user.id) {
      throw new HttpError(404, "Category not found");
    }
    await prisma.category.delete({ where: { id } });
    logger.info(`User ${user.username} deleted category ${id}`);
    res.status(204).end();
  })
);

export default router;
