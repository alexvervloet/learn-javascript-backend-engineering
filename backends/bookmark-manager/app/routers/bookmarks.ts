// Bookmark routes

import express from "express";

import prisma from "../database.js";
import { getCurrentUser, currentUser } from "../dependencies.js";
import { HttpError, asyncHandler } from "../exceptions.js";
import { limit } from "../rate_limit.js";
import { getRedis } from "../redis_client.js";
import { makeLogger } from "../logging_config.js";
import { validateBody, validatedBody } from "../validate.js";
import { pathParamInt, queryParam } from "../request.js";
import { bookmarkCreate, bookmarkUpdate } from "../schemas/bookmark.js";
import { bookmarkPublic } from "../schemas/serializers.js";
import { fetchBookmarkMetadata, CLICK_KEY_PREFIX } from "../tasks.js";
import type { Prisma } from "../generated/prisma/index.js";

const router = express.Router();
const logger = makeLogger("app.routers.bookmarks");

// Get-or-create each tag via Prisma's connectOrCreate using the
// (name, user_id) composite unique constraint.
function tagConnectOrCreate(
  userId: number,
  names: string[]
): Prisma.TagCreateOrConnectWithoutBookmarksInput[] {
  return names.map((name) => ({
    where: { uq_tag_name_user: { name, userId } },
    create: { name, userId },
  }));
}

async function validateCategory(
  userId: number,
  categoryId: number | null | undefined
): Promise<void> {
  if (categoryId === null || categoryId === undefined) return;
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category || category.userId !== userId) {
    throw new HttpError(404, "Category not found");
  }
}

router.post(
  "/",
  getCurrentUser,
  limit(30),
  validateBody(bookmarkCreate),
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const input = validatedBody(req, bookmarkCreate);
    await validateCategory(user.id, input.category_id);

    const url = input.url;
    const bookmark = await prisma.bookmark.create({
      data: {
        url,
        title: input.title || url,
        description: input.description ?? null,
        favorite: input.favorite,
        categoryId: input.category_id ?? null,
        userId: user.id,
        tags: { connectOrCreate: tagConnectOrCreate(user.id, input.tags) },
      },
      include: { tags: true },
    });

    if (!input.title) {
      await fetchBookmarkMetadata.delay(bookmark.id, url);
    }

    logger.info(`User ${user.username} created bookmark ${bookmark.id}`);
    res.status(201).json(bookmarkPublic(bookmark));
  })
);

router.get(
  "/",
  getCurrentUser,
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    // Typing the filter as Prisma's own where-input means a mistyped field name
    // fails to compile rather than silently widening the result set.
    const where: Prisma.BookmarkWhereInput = { userId: user.id };
    const categoryId = queryParam(req, "category_id");
    if (categoryId !== undefined) {
      where.categoryId = Number.parseInt(categoryId, 10);
    }
    const favorite = queryParam(req, "favorite");
    if (favorite !== undefined) {
      where.favorite = favorite === "true";
    }
    const tag = queryParam(req, "tag");
    if (tag !== undefined) {
      where.tags = { some: { name: tag } };
    }
    const offset = Number.parseInt(queryParam(req, "offset") ?? "0", 10);
    const limitParam = Math.min(
      Number.parseInt(queryParam(req, "limit") ?? "50", 10),
      100
    );

    const bookmarks = await prisma.bookmark.findMany({
      where,
      include: { tags: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: offset,
      take: limitParam,
    });
    res.json(bookmarks.map(bookmarkPublic));
  })
);

router.get(
  "/:bookmarkId",
  getCurrentUser,
  asyncHandler(async (req, res) => {
    const bookmark = await prisma.bookmark.findUnique({
      where: { id: pathParamInt(req, "bookmarkId") },
      include: { tags: true },
    });
    if (!bookmark || bookmark.userId !== currentUser(req).id) {
      throw new HttpError(404, "Bookmark not found");
    }
    res.json(bookmarkPublic(bookmark));
  })
);

router.patch(
  "/:bookmarkId",
  getCurrentUser,
  validateBody(bookmarkUpdate),
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const id = pathParamInt(req, "bookmarkId");
    const existing = await prisma.bookmark.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id) {
      throw new HttpError(404, "Bookmark not found");
    }

    const input = validatedBody(req, bookmarkUpdate);
    const data: Prisma.BookmarkUpdateInput = {};
    // Apply only fields the client actually sent (exclude_unset semantics).
    if (input.url !== undefined) data.url = input.url;
    if (input.title !== undefined) data.title = input.title ?? existing.url;
    if (input.description !== undefined) data.description = input.description;
    if (input.favorite !== undefined) data.favorite = input.favorite;
    if (input.category_id !== undefined) {
      await validateCategory(user.id, input.category_id);
      // categoryId is a relation field, so the update goes through connect or
      // disconnect rather than assigning the raw foreign key.
      data.category =
        input.category_id === null
          ? { disconnect: true }
          : { connect: { id: input.category_id } };
    }
    data.updatedAt = new Date();

    if (input.tags != null) {
      data.tags = { set: [], connectOrCreate: tagConnectOrCreate(user.id, input.tags) };
    }

    const bookmark = await prisma.bookmark.update({
      where: { id },
      data,
      include: { tags: true },
    });
    logger.info(`User ${user.username} updated bookmark ${bookmark.id}`);
    res.json(bookmarkPublic(bookmark));
  })
);

router.delete(
  "/:bookmarkId",
  getCurrentUser,
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const id = pathParamInt(req, "bookmarkId");
    const bookmark = await prisma.bookmark.findUnique({ where: { id } });
    if (!bookmark || bookmark.userId !== user.id) {
      throw new HttpError(404, "Bookmark not found");
    }
    await prisma.bookmark.delete({ where: { id } });
    logger.info(`User ${user.username} deleted bookmark ${id}`);
    res.status(204).end();
  })
);

// Increment the click counter for a bookmark in Redis. The DB column is updated
// every 10 minutes by flushBookmarkClicks — a write-behind cache.
router.post(
  "/:bookmarkId/click",
  getCurrentUser,
  asyncHandler(async (req, res) => {
    const id = pathParamInt(req, "bookmarkId");
    const bookmark = await prisma.bookmark.findUnique({ where: { id } });
    if (!bookmark || bookmark.userId !== currentUser(req).id) {
      throw new HttpError(404, "Bookmark not found");
    }
    await getRedis().incr(`${CLICK_KEY_PREFIX}${id}`);
    res.status(204).end();
  })
);

export default router;
