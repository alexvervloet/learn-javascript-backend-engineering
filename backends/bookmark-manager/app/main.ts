// Express application factory. Builds and exports the configured app (CORS, body
// parsing, routers, health, error handling). The network listen happens in
// server.ts, keeping the app importable for tests.

import express from "express";
import cors from "cors";

import { getSettings } from "./config.js";
import { errorHandler } from "./exceptions.js";
import authRouter from "./routers/auth.js";
import bookmarksRouter from "./routers/bookmarks.js";
import categoriesRouter from "./routers/categories.js";
import tagsRouter from "./routers/tags.js";

const settings = getSettings();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:5174",
      "http://127.0.0.1:5175",
    ],
    credentials: true,
  })
);

app.use("/auth", authRouter);
app.use("/bookmarks", bookmarksRouter);
app.use("/tags", tagsRouter);
app.use("/categories", categoriesRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", environment: settings.environment });
});

app.use(errorHandler);

export default app;
