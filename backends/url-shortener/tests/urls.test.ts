import { test, expect } from "@jest/globals";
import { api, prisma, createUser, shorten } from "./setup.js";

test("create returns a slug and the full short url", async () => {
  const { headers } = await createUser();
  const res = await api()
    .post("/urls")
    .set(headers)
    .send({ original_url: "https://example.com/a/long/path" });
  expect(res.status).toBe(201);
  expect(res.body.original_url).toBe("https://example.com/a/long/path");
  expect(res.body.short_code).toEqual(expect.any(String));
  expect(res.body.short_url).toBe(`http://localhost:8000/${res.body.short_code}`);
  expect(res.body.click_count).toBe(0);
  expect(res.body.is_active).toBe(true);
});

test("create requires auth", async () => {
  const res = await api().post("/urls").send({ original_url: "https://example.com" });
  expect(res.status).toBe(401);
});

test("create rejects a url without a scheme", async () => {
  const { headers } = await createUser();
  const res = await api().post("/urls").set(headers).send({ original_url: "example.com" });
  expect(res.status).toBe(422);
});

test("create accepts a custom code", async () => {
  const { headers } = await createUser();
  const res = await api()
    .post("/urls")
    .set(headers)
    .send({ original_url: "https://example.com", custom_code: "mycode" });
  expect(res.status).toBe(201);
  expect(res.body.short_code).toBe("mycode");
});

test("a taken custom code is a conflict, not a silent rename", async () => {
  const { headers } = await createUser();
  await shorten(headers, "https://example.com/first", "taken");
  const res = await api()
    .post("/urls")
    .set(headers)
    .send({ original_url: "https://example.com/second", custom_code: "taken" });
  expect(res.status).toBe(409);
});

test("generated slugs are distinct for the same target url", async () => {
  const { headers } = await createUser();
  const first = await shorten(headers, "https://example.com/same");
  const second = await shorten(headers, "https://example.com/same");
  expect(first).not.toBe(second);
});

test("list paginates", async () => {
  const { headers } = await createUser();
  for (let i = 0; i < 5; i += 1) {
    await shorten(headers, `https://example.com/${i}`);
  }
  const res = await api().get("/urls?page=1&page_size=2");
  expect(res.status).toBe(200);
  expect(res.body.items).toHaveLength(2);
  expect(res.body.total).toBe(5);
  expect(res.body.page).toBe(1);
  expect(res.body.page_size).toBe(2);
});

test("list clamps a silly page size instead of trusting it", async () => {
  const { headers } = await createUser();
  await shorten(headers);
  const res = await api().get("/urls?page_size=100000");
  expect(res.status).toBe(200);
  expect(res.body.page_size).toBe(100);
});

test("stats reports the click count", async () => {
  const { headers } = await createUser();
  const code = await shorten(headers);
  const res = await api().get(`/urls/${code}/stats`);
  expect(res.status).toBe(200);
  expect(res.body.click_count).toBe(0);
});

test("stats on an unknown slug is a 404", async () => {
  const res = await api().get("/urls/nosuchcode/stats");
  expect(res.status).toBe(404);
});

test("delete deactivates rather than dropping the row", async () => {
  const { headers } = await createUser();
  const code = await shorten(headers);

  const res = await api().delete(`/urls/${code}`).set(headers);
  expect(res.status).toBe(204);

  // The row survives, so the slug can never be handed out again and the click
  // history stays. That is why the route sets is_active instead of deleting.
  const row = await prisma.url.findUnique({ where: { shortCode: code } });
  expect(row).not.toBeNull();
  expect(row?.isActive).toBe(false);
});

test("delete requires auth", async () => {
  const { headers } = await createUser();
  const code = await shorten(headers);
  const res = await api().delete(`/urls/${code}`);
  expect(res.status).toBe(401);
});

test("delete on an unknown slug is a 404", async () => {
  const { headers } = await createUser();
  const res = await api().delete("/urls/nosuchcode").set(headers);
  expect(res.status).toBe(404);
});
