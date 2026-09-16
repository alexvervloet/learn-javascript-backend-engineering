import { test, expect } from "@jest/globals";
import { api, defaultUser } from "./setup.js";

test("register user", async () => {
  const res = await api()
    .post("/auth/register")
    .send({ email: "new@example.com", username: "newuser", password: "newpass123" });
  expect(res.status).toBe(201);
  expect(res.body.email).toBe("new@example.com");
  expect(res.body.username).toBe("newuser");
  expect(res.body).not.toHaveProperty("password");
  expect(res.body).not.toHaveProperty("password_hash");
});

test("register short password rejected", async () => {
  const res = await api()
    .post("/auth/register")
    .send({ email: "x@example.com", username: "shorty", password: "short" });
  expect(res.status).toBe(422);
});

test("register invalid email rejected", async () => {
  const res = await api()
    .post("/auth/register")
    .send({ email: "not-an-email", username: "newuser", password: "longenough" });
  expect(res.status).toBe(422);
});

test("register duplicate email", async () => {
  await defaultUser();
  const res = await api()
    .post("/auth/register")
    .send({ email: "test@example.com", username: "different", password: "newpass123" });
  expect(res.status).toBe(400);
});

test("register duplicate username", async () => {
  await defaultUser();
  const res = await api()
    .post("/auth/register")
    .send({ email: "different@example.com", username: "testuser", password: "newpass123" });
  expect(res.status).toBe(400);
});

test("login success", async () => {
  await defaultUser();
  const res = await api()
    .post("/auth/token")
    .type("form")
    .send({ username: "testuser", password: "testpass123" });
  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty("access_token");
  expect(res.body.token_type).toBe("bearer");
});

test("login wrong password", async () => {
  await defaultUser();
  const res = await api()
    .post("/auth/token")
    .type("form")
    .send({ username: "testuser", password: "wrongpassword" });
  expect(res.status).toBe(401);
});

test("login unknown user", async () => {
  const res = await api()
    .post("/auth/token")
    .type("form")
    .send({ username: "ghost", password: "irrelevant" });
  expect(res.status).toBe(401);
});

test("me with valid token", async () => {
  const { headers } = await defaultUser();
  const res = await api().get("/auth/me").set(headers);
  expect(res.status).toBe(200);
  expect(res.body.username).toBe("testuser");
});

test("me without token", async () => {
  const res = await api().get("/auth/me");
  expect(res.status).toBe(401);
});

test("me invalid token", async () => {
  const res = await api().get("/auth/me").set({ Authorization: "Bearer not-a-real-token" });
  expect(res.status).toBe(401);
});

test("logout blocklists token", async () => {
  const { headers } = await defaultUser();
  expect((await api().get("/auth/me").set(headers)).status).toBe(200);

  const res = await api().post("/auth/logout").set(headers);
  expect(res.status).toBe(204);

  expect((await api().get("/auth/me").set(headers)).status).toBe(401);
});

test("logout requires auth", async () => {
  const res = await api().post("/auth/logout");
  expect(res.status).toBe(401);
});

test("new login after logout works", async () => {
  const { headers } = await defaultUser();
  await api().post("/auth/logout").set(headers);

  const login = await api()
    .post("/auth/token")
    .type("form")
    .send({ username: "testuser", password: "testpass123" });
  expect(login.status).toBe(200);

  const newToken = login.body.access_token;
  const me = await api().get("/auth/me").set({ Authorization: `Bearer ${newToken}` });
  expect(me.status).toBe(200);
});
