import express from "express";

const app = express();

// Injected at build time via ARG → ENV in the Dockerfile.
// Local builds show "local-build"; CI builds show the exact git SHA.
const BUILD_SHA = process.env.BUILD_SHA || "local-build";

app.get("/", (_req, res) => res.json({ message: "Hello from CI/CD!" }));
app.get("/health", (_req, res) => res.json({ status: "ok" }));
// Proves the CI-built image is what's running — compare this SHA to the GitHub Actions run.
app.get("/version", (_req, res) => res.json({ build_sha: BUILD_SHA, is_ci_build: BUILD_SHA !== "local-build" }));

app.listen(8000, () => console.log("listening on http://0.0.0.0:8000"));
