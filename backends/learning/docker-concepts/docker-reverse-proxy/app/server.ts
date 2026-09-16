import express from "express";

const app = express();

app.get("/", (req, res) =>
  res.json({
    message: "Hello from behind nginx!",
    x_real_ip: req.headers["x-real-ip"] || "not set",
    x_forwarded_for: req.headers["x-forwarded-for"] || "not set",
    x_forwarded_proto: req.headers["x-forwarded-proto"] || "not set",
    host: req.headers.host || "not set",
  })
);

app.get("/health", (_req, res) => res.json({ status: "ok" }));
// Show every header — useful for seeing what nginx forwards.
app.get("/headers", (req, res) => res.json(req.headers));

app.listen(8000, () => console.log("listening on http://0.0.0.0:8000"));
