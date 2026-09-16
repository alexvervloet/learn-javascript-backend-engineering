// URL management routes

import express from "express";

import prisma from "../database.js";
import * as cache from "../cache.js";
import { getCurrentUser } from "../auth.js";
import { getSettings } from "../config.js";
import { HttpError, asyncHandler, isPrismaErrorWithCode } from "../errors.js";
import { validateBody, validatedBody } from "../validate.js";
import { urlCreate, urlResponse, urlStats } from "../schemas.js";
import { generateShortCode } from "../shortener.js";
import { pathParam, queryParam } from "../request.js";

const router = express.Router();

const MAX_RETRIES = 5;

router.post(
  "/",
  getCurrentUser,
  validateBody(urlCreate),
  asyncHandler(async (req, res) => {
    const input = validatedBody(req, urlCreate);
    const baseUrl = getSettings().baseUrl;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
      const shortCode = input.custom_code || generateShortCode();
      try {
        const url = await prisma.url.create({
          data: {
            shortCode,
            originalUrl: input.original_url,
            expiresAt: input.expires_at ?? null,
          },
        });
        return res.status(201).json(urlResponse(url, baseUrl));
      } catch (err) {
        if (!isPrismaErrorWithCode(err, "P2002")) throw err;
        // short_code collision — retry with a fresh code unless it was custom.
        if (input.custom_code) {
          throw new HttpError(409, "Custom code already taken");
        }
      }
    }
    throw new HttpError(500, "Failed to generate a unique short code");
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const page = Math.max(Number.parseInt(queryParam(req, "page", "1"), 10), 1);
    const pageSize = Math.min(
      Math.max(Number.parseInt(queryParam(req, "page_size", "20"), 10), 1),
      100
    );
    const offset = (page - 1) * pageSize;
    const baseUrl = getSettings().baseUrl;

    const [total, rows] = await Promise.all([
      prisma.url.count(),
      prisma.url.findMany({
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: pageSize,
      }),
    ]);

    res.json({
      items: rows.map((u) => urlResponse(u, baseUrl)),
      total,
      page,
      page_size: pageSize,
    });
  })
);

router.get(
  "/:shortCode/stats",
  asyncHandler(async (req, res) => {
    const url = await prisma.url.findUnique({
      where: { shortCode: pathParam(req, "shortCode") },
    });
    if (!url) throw new HttpError(404, "Short URL not found");
    res.json(urlStats(url));
  })
);

router.delete(
  "/:shortCode",
  getCurrentUser,
  asyncHandler(async (req, res) => {
    const shortCode = pathParam(req, "shortCode");
    const url = await prisma.url.findUnique({ where: { shortCode } });
    if (!url) throw new HttpError(404, "Short URL not found");
    await prisma.url.update({ where: { id: url.id }, data: { isActive: false } });
    await cache.invalidate(shortCode);
    res.status(204).end();
  })
);

export default router;
