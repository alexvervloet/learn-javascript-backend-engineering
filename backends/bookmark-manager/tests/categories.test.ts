import { test, expect } from "@jest/globals";
import { api, defaultUser, otherUser } from "./setup.js";
import type { CategoryPublic } from "../app/schemas/serializers.js";

test("create category", async () => {
  const { headers } = await defaultUser();
  const res = await api()
    .post("/categories/")
    .set(headers)
    .send({ name: "Work", description: "Work-related links" });
  expect(res.status).toBe(201);
  expect(res.body.name).toBe("Work");
  expect(res.body.description).toBe("Work-related links");
});

test("create duplicate category rejected", async () => {
  const { headers } = await defaultUser();
  await api().post("/categories/").set(headers).send({ name: "Work" });
  const res = await api().post("/categories/").set(headers).send({ name: "Work" });
  expect(res.status).toBe(400);
});

test("categories isolated per user", async () => {
  const { headers } = await defaultUser();
  const { headers: otherHeaders } = await otherUser();
  await api().post("/categories/").set(headers).send({ name: "Work" });
  await api().post("/categories/").set(otherHeaders).send({ name: "Personal" });

  const res = await api().get("/categories/").set(headers);
  expect(new Set(res.body.map((c: CategoryPublic) => c.name))).toEqual(new Set(["Work"]));
});

test("update category", async () => {
  const { headers } = await defaultUser();
  const created = (await api().post("/categories/").set(headers).send({ name: "Work" })).body;
  const res = await api()
    .patch(`/categories/${created.id}`)
    .set(headers)
    .send({ description: "Office stuff" });
  expect(res.status).toBe(200);
  expect(res.body.description).toBe("Office stuff");
});

test("delete category", async () => {
  const { headers } = await defaultUser();
  const created = (await api().post("/categories/").set(headers).send({ name: "Temp" })).body;
  const del = await api().delete(`/categories/${created.id}`).set(headers);
  expect(del.status).toBe(204);
  const res = await api().get(`/categories/${created.id}`).set(headers);
  expect(res.status).toBe(404);
});

test("get other user's category returns 404", async () => {
  const { headers } = await defaultUser();
  const { headers: otherHeaders } = await otherUser();
  const created = (
    await api().post("/categories/").set(otherHeaders).send({ name: "Private" })
  ).body;
  const res = await api().get(`/categories/${created.id}`).set(headers);
  expect(res.status).toBe(404);
});

test("bookmark can reference category", async () => {
  const { headers } = await defaultUser();
  const category = (await api().post("/categories/").set(headers).send({ name: "Reading" })).body;
  const res = await api()
    .post("/bookmarks/")
    .set(headers)
    .send({ url: "https://example.com", category_id: category.id });
  expect(res.status).toBe(201);
  expect(res.body.category_id).toBe(category.id);
});
