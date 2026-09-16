// Slug → redirect with click tracking

import express from "express";

import prisma from "../database.js";
import * as cache from "../cache.js";
import { asyncHandler, HttpError } from "../errors.js";
import { incrementClick } from "../tasks.js";
import { pathParam } from "../request.js";

const router = express.Router();

router.get(
  "/:shortCode",
  asyncHandler(async (req, res) => {
    const shortCode = pathParam(req, "shortCode");

    // Hot path: Redis cache hit — no DB query, click counted async via the queue.
    const cachedUrl = await cache.get(shortCode);
    if (cachedUrl) {
      await incrementClick.delay(shortCode);
      return res.redirect(301, cachedUrl);
    }

    const url = await prisma.url.findFirst({
      where: { shortCode, isActive: true },
    });
    if (!url) throw new HttpError(404, "Short URL not found");

    if (url.expiresAt && url.expiresAt < new Date()) {
      throw new HttpError(410, "This short URL has expired");
    }

    await cache.set(shortCode, url.originalUrl);
    await incrementClick.delay(shortCode);

    res.redirect(301, url.originalUrl);
  })
);

export default router;
