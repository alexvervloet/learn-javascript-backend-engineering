// Express application factory. The redirect router is mounted last because its
// `/:shortCode` route would otherwise shadow /urls, /auth, and /health.

import express from "express";

import * as cache from "./cache.js";
import { errorHandler } from "./errors.js";
import authRouter from "./routers/auth.js";
import urlsRouter from "./routers/urls.js";
import redirectRouter from "./routers/redirect.js";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get("/health", async (_req, res) => {
  res.json({ status: "ok", cache: await cache.stats() });
});

app.use("/auth", authRouter);
app.use("/urls", urlsRouter);
app.use("/", redirectRouter);

app.use(errorHandler);

export default app;
