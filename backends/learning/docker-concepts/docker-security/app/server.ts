import fs from "node:fs";
import os from "node:os";
import express from "express";

const app = express();

// Read a Docker secret mounted at /run/secrets/<name>. This is how a compose
// `secrets:` entry surfaces — as a file, never an env var (so it's not visible
// in `docker inspect`).
function readSecret(name: string): string | null {
  try {
    return fs.readFileSync(`/run/secrets/${name}`, "utf8").trim();
  } catch {
    return null;
  }
}

app.get("/", (_req, res) => res.json({ message: "Docker Security Practice", env: process.env.APP_ENV || "unknown" }));
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// Proves the container runs as non-root. Secure image → uid 1001; insecure → uid 0.
app.get("/whoami", (_req, res) => {
  const uid = typeof process.getuid === "function" ? process.getuid() : -1;
  let username = `uid:${uid}`;
  try {
    username = os.userInfo().username;
  } catch {
    /* userInfo can throw for unknown uids */
  }
  res.json({ uid, username, is_root: uid === 0 });
});

// Verifies the secret is readable via /run/secrets but NOT present as an env var.
app.get("/secrets/check", (_req, res) => {
  const secret = readSecret("app_secret_key");
  res.json({
    secret_mounted: secret !== null,
    secret_in_env: "APP_SECRET_KEY" in process.env, // should always be false
    secret_length: secret ? secret.length : 0,
  });
});

app.listen(8000, () => console.log("listening on http://0.0.0.0:8000"));
