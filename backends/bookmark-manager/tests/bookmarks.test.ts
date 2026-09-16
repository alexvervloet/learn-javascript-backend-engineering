import { test, expect } from "@jest/globals";
import { api, getRedis, defaultUser, otherUser } from "./setup.js";
import { flushBookmarkClicks } from "../app/tasks.js";
import type { TagPublic } from "../app/schemas/serializers.js";

test("create bookmark minimal", async () => {
  const { headers } = await defaultUser();
  const res = await api().post("/bookmarks/").set(headers).send({ url: "https://example.com" });
  expect(res.status).toBe(201);
  expect(res.body.url).toMatch(/^https:\/\/example\.com/);
  expect(res.body.title).toBe(res.body.url);
  expect(res.body.favorite).toBe(false);
  expect(res.body.tags).toEqual([]);
});

test("create bookmark with tags", async () => {
  const { headers } = await defaultUser();
  const res = await api()
    .post("/bookmarks/")
    .set(headers)
    .send({
      url: "https://example.com/foo",
      title: "Foo Page",
      description: "A page about foo",
      favorite: true,
      tags: ["javascript", "tutorial"],
    });
  expect(res.status).toBe(201);
  expect(res.body.title).toBe("Foo Page");
  expect(res.body.favorite).toBe(true);
  expect(new Set(res.body.tags.map((t: TagPublic) => t.name))).toEqual(new Set(["javascript", "tutorial"]));
});

test("create bookmark invalid url", async () => {
  const { headers } = await defaultUser();
  const res = await api().post("/bookmarks/").set(headers).send({ url: "not-a-url" });
  expect(res.status).toBe(422);
});

test("create bookmark without auth", async () => {
  const res = await api().post("/bookmarks/").send({ url: "https://example.com" });
  expect(res.status).toBe(401);
});

test("list bookmarks isolated per user", async () => {
  const { headers } = await defaultUser();
  const { headers: otherHeaders } = await otherUser();
  await api().post("/bookmarks/").set(headers).send({ url: "https://a.test" });
  await api().post("/bookmarks/").set(otherHeaders).send({ url: "https://b.test" });

  const res = await api().get("/bookmarks/").set(headers);
  expect(res.status).toBe(200);
  expect(res.body).toHaveLength(1);
  expect(res.body[0].url).toMatch(/^https:\/\/a\.test/);
});

test("list bookmarks filter favorite", async () => {
  const { headers } = await defaultUser();
  await api().post("/bookmarks/").set(headers).send({ url: "https://a.test", favorite: true });
  await api().post("/bookmarks/").set(headers).send({ url: "https://b.test" });

  const res = await api().get("/bookmarks/?favorite=true").set(headers);
  expect(res.status).toBe(200);
  expect(res.body).toHaveLength(1);
});

test("get bookmark", async () => {
  const { headers } = await defaultUser();
  const created = (
    await api().post("/bookmarks/").set(headers).send({ url: "https://example.com" })
  ).body;
  const res = await api().get(`/bookmarks/${created.id}`).set(headers);
  expect(res.status).toBe(200);
  expect(res.body.id).toBe(created.id);
});

test("get other user's bookmark returns 404", async () => {
  const { headers } = await defaultUser();
  const { headers: otherHeaders } = await otherUser();
  const created = (
    await api().post("/bookmarks/").set(otherHeaders).send({ url: "https://secret.test" })
  ).body;
  const res = await api().get(`/bookmarks/${created.id}`).set(headers);
  expect(res.status).toBe(404);
});

test("update bookmark", async () => {
  const { headers } = await defaultUser();
  const created = (
    await api().post("/bookmarks/").set(headers).send({ url: "https://example.com" })
  ).body;
  const res = await api()
    .patch(`/bookmarks/${created.id}`)
    .set(headers)
    .send({ title: "Updated", favorite: true, tags: ["new"] });
  expect(res.status).toBe(200);
  expect(res.body.title).toBe("Updated");
  expect(res.body.favorite).toBe(true);
  expect(new Set(res.body.tags.map((t: TagPublic) => t.name))).toEqual(new Set(["new"]));
});

test("delete bookmark", async () => {
  const { headers } = await defaultUser();
  const created = (
    await api().post("/bookmarks/").set(headers).send({ url: "https://example.com" })
  ).body;
  const del = await api().delete(`/bookmarks/${created.id}`).set(headers);
  expect(del.status).toBe(204);
  const res = await api().get(`/bookmarks/${created.id}`).set(headers);
  expect(res.status).toBe(404);
});

test("bookmark with invalid category returns 404", async () => {
  const { headers } = await defaultUser();
  const res = await api()
    .post("/bookmarks/")
    .set(headers)
    .send({ url: "https://example.com", category_id: 9999 });
  expect(res.status).toBe(404);
});

// ─── Click tracking (write-behind cache) ─────────────────────────────────────

test("record click increments redis", async () => {
  const { headers } = await defaultUser();
  const created = (
    await api().post("/bookmarks/").set(headers).send({ url: "https://example.com" })
  ).body;

  const res = await api().post(`/bookmarks/${created.id}/click`).set(headers);
  expect(res.status).toBe(204);
  expect(await getRedis().get(`bookmark_clicks:${created.id}`)).toBe("1");

  await api().post(`/bookmarks/${created.id}/click`).set(headers);
  expect(await getRedis().get(`bookmark_clicks:${created.id}`)).toBe("2");
});

test("record click does not immediately update db", async () => {
  const { headers } = await defaultUser();
  const created = (
    await api().post("/bookmarks/").set(headers).send({ url: "https://example.com" })
  ).body;
  await api().post(`/bookmarks/${created.id}/click`).set(headers);

  const res = await api().get(`/bookmarks/${created.id}`).set(headers);
  expect(res.body.click_count).toBe(0);
});

test("record click other user returns 404", async () => {
  const { headers } = await defaultUser();
  const { headers: otherHeaders } = await otherUser();
  const otherBm = (
    await api().post("/bookmarks/").set(otherHeaders).send({ url: "https://example.com" })
  ).body;
  const res = await api().post(`/bookmarks/${otherBm.id}/click`).set(headers);
  expect(res.status).toBe(404);
});

test("record click requires auth", async () => {
  const res = await api().post("/bookmarks/1/click");
  expect(res.status).toBe(401);
});

test("flush bookmark clicks writes to db", async () => {
  const { headers } = await defaultUser();
  const created = (
    await api().post("/bookmarks/").set(headers).send({ url: "https://example.com" })
  ).body;

  const r = getRedis();
  for (let i = 0; i < 3; i += 1) await r.incr(`bookmark_clicks:${created.id}`);

  const result = await flushBookmarkClicks();
  expect(result).toEqual({ flushed: 3, bookmarks: 1 });

  expect(await r.get(`bookmark_clicks:${created.id}`)).toBeNull();

  const res = await api().get(`/bookmarks/${created.id}`).set(headers);
  expect(res.body.click_count).toBe(3);
});

test("flush bookmark clicks accumulates", async () => {
  const { headers } = await defaultUser();
  const created = (
    await api().post("/bookmarks/").set(headers).send({ url: "https://example.com" })
  ).body;
  const r = getRedis();

  await r.incr(`bookmark_clicks:${created.id}`);
  await r.incr(`bookmark_clicks:${created.id}`);
  await flushBookmarkClicks();

  for (let i = 0; i < 5; i += 1) await r.incr(`bookmark_clicks:${created.id}`);
  await flushBookmarkClicks();

  const res = await api().get(`/bookmarks/${created.id}`).set(headers);
  expect(res.body.click_count).toBe(7);
});

test("flush with no clicks is noop", async () => {
  expect(await flushBookmarkClicks()).toEqual({ flushed: 0, bookmarks: 0 });
});

test("flush drops clicks for deleted bookmarks", async () => {
  const { headers } = await defaultUser();
  const created = (
    await api().post("/bookmarks/").set(headers).send({ url: "https://example.com" })
  ).body;

  await getRedis().incr(`bookmark_clicks:${created.id}`);
  await api().delete(`/bookmarks/${created.id}`).set(headers);

  const result = await flushBookmarkClicks();
  expect(result).toEqual({ flushed: 0, bookmarks: 1 });
});
