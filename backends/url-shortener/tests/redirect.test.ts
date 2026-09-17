// The redirect path is the one the whole service exists for, and the only place
// the cache and the background queue are both in play.

import { test, expect } from "@jest/globals";
import { api, prisma, cache, enqueued, createUser, shorten } from "./setup.js";
import { incrementClick } from "../app/tasks.js";

test("a known slug redirects permanently to the target", async () => {
  const { headers } = await createUser();
  const code = await shorten(headers, "https://example.com/destination");

  const res = await api().get(`/${code}`);
  expect(res.status).toBe(301);
  expect(res.headers.location).toBe("https://example.com/destination");
});

test("an unknown slug is a 404", async () => {
  const res = await api().get("/nosuchcode");
  expect(res.status).toBe(404);
});

test("a deactivated slug stops redirecting", async () => {
  const { headers } = await createUser();
  const code = await shorten(headers);
  await api().delete(`/urls/${code}`).set(headers);

  const res = await api().get(`/${code}`);
  expect(res.status).toBe(404);
});

test("an expired slug is 410, not 404", async () => {
  const { headers } = await createUser();
  const code = await shorten(headers);
  await prisma.url.update({
    where: { shortCode: code },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });

  const res = await api().get(`/${code}`);
  // 410 Gone says the slug was real and is finished, which is a different thing
  // to tell a caller than "never existed".
  expect(res.status).toBe(410);
});

test("the first redirect populates the cache", async () => {
  const { headers } = await createUser();
  const code = await shorten(headers, "https://example.com/cached");

  expect(await cache.get(code)).toBeNull();
  await api().get(`/${code}`);
  expect(await cache.get(code)).toBe("https://example.com/cached");
});

test("a cached redirect does not touch the database", async () => {
  const { headers } = await createUser();
  const code = await shorten(headers, "https://example.com/hot");
  await api().get(`/${code}`); // warm it

  // Delete the row outright. A second request that still redirects proves the
  // answer came from Redis, which is the whole point of the cache on this path.
  await prisma.url.deleteMany({ where: { shortCode: code } });

  const res = await api().get(`/${code}`);
  expect(res.status).toBe(301);
  expect(res.headers.location).toBe("https://example.com/hot");
});

test("deleting a slug invalidates its cache entry", async () => {
  const { headers } = await createUser();
  const code = await shorten(headers);
  await api().get(`/${code}`); // warm it
  expect(await cache.get(code)).not.toBeNull();

  await api().delete(`/urls/${code}`).set(headers);
  // Without the invalidate, the cached entry would keep serving a redirect for
  // a slug the owner just turned off.
  expect(await cache.get(code)).toBeNull();
  expect((await api().get(`/${code}`)).status).toBe(404);
});

test("every redirect enqueues one click, cached or not", async () => {
  const { headers } = await createUser();
  const code = await shorten(headers);

  await api().get(`/${code}`); // cache miss
  await api().get(`/${code}`); // cache hit
  await api().get(`/${code}`); // cache hit

  expect(enqueued).toEqual([code, code, code]);
});

test("a 404 enqueues nothing", async () => {
  await api().get("/nosuchcode");
  expect(enqueued).toEqual([]);
});

test("redirect does not shadow the other routes", async () => {
  // /:shortCode is mounted at the root, so it would swallow /health, /urls and
  // /auth if it were registered before them. main.ts mounts it last.
  expect((await api().get("/health")).status).toBe(200);
  expect((await api().get("/urls")).status).toBe(200);
});

// setup.ts stubs incrementClick.delay so the routes never touch BullMQ, which
// leaves the worker's own job unexercised. This is that half: what the worker
// runs when it picks a job up.
test("the worker side of a click actually increments the counter", async () => {
  const { headers } = await createUser();
  const code = await shorten(headers);

  await incrementClick(code);
  await incrementClick(code);

  const res = await api().get(`/urls/${code}/stats`);
  expect(res.body.click_count).toBe(2);
});

test("a click on an unknown slug is a no-op, not a crash", async () => {
  // The worker uses updateMany, which matches zero rows rather than throwing.
  // A job for a slug deleted since it was queued must not kill the worker.
  await expect(incrementClick("nosuchcode")).resolves.toBeUndefined();
  expect(await prisma.url.count()).toBe(0);
});
