import express from "express";

const app = express();

app.get("/", (_req, res) => res.json({ message: "Hello from Docker!", stage: "multi-stage build" }));
app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.get("/items/:id", (req, res) => res.json({ item_id: Number(req.params.id), q: req.query.q ?? null }));

const PORT = Number(process.env.PORT || 8000);
app.listen(PORT, () => console.log(`listening on http://0.0.0.0:${PORT}`));
