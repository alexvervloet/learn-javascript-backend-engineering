FROM node:22-slim
WORKDIR /app
COPY app/package*.json ./
RUN npm install --omit=dev
COPY app/ .

EXPOSE 8000

# BUG 1 — the app is told to listen on port 9000 (via PORT), but compose maps
# host 8000 → container 8000. Nothing listens on 8000 inside the container.
# Symptom:  curl localhost:8000 → connection refused
# Find it:  docker compose logs app  (shows "listening on ...:9000")
# Fix:      remove this ENV (or set PORT=8000)
ENV PORT=9000
CMD ["node", "server.ts"]
