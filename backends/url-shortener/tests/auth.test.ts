import { test, expect } from "@jest/globals";
import { api, createUser } from "./setup.js";

test("register returns a token", async () => {
  const res = await api()
    .post("/auth/register")
    .send({ username: "newuser", password: "supersecret123" });
  expect(res.status).toBe(201);
  expect(res.body).toHaveProperty("access_token");
  expect(res.body.token_type).toBe("bearer");
});

test("register never echoes the password back", async () => {
  const res = await api()
    .post("/auth/register")
    .send({ username: "newuser", password: "supersecret123" });
  expect(JSON.stringify(res.body)).not.toContain("supersecret123");
  expect(res.body).not.toHaveProperty("hashedPassword");
});

test("register rejects a short password", async () => {
  const res = await api()
    .post("/auth/register")
    .send({ username: "newuser", password: "short" });
  expect(res.status).toBe(422);
});

test("register rejects a duplicate username", async () => {
  await createUser("taken");
  const res = await api()
    .post("/auth/register")
    .send({ username: "taken", password: "supersecret123" });
  expect(res.status).toBe(409);
});

test("token endpoint issues a token for good credentials", async () => {
  await api().post("/auth/register").send({ username: "alex", password: "supersecret123" });
  const res = await api()
    .post("/auth/token")
    .send({ username: "alex", password: "supersecret123" });
  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty("access_token");
});

test("token endpoint rejects a wrong password", async () => {
  await api().post("/auth/register").send({ username: "alex", password: "supersecret123" });
  const res = await api()
    .post("/auth/token")
    .send({ username: "alex", password: "wrongpassword" });
  expect(res.status).toBe(401);
});

test("token endpoint rejects an unknown user", async () => {
  const res = await api()
    .post("/auth/token")
    .send({ username: "ghost", password: "irrelevant123" });
  expect(res.status).toBe(401);
});

// The password is checked even when the user does not exist, so a caller cannot
// tell "no such user" from "wrong password" by the response.
test("both login failures look the same from outside", async () => {
  await api().post("/auth/register").send({ username: "alex", password: "supersecret123" });
  const wrongPassword = await api()
    .post("/auth/token")
    .send({ username: "alex", password: "wrongpassword" });
  const noSuchUser = await api()
    .post("/auth/token")
    .send({ username: "ghost", password: "wrongpassword" });
  expect(wrongPassword.status).toBe(noSuchUser.status);
  expect(wrongPassword.body).toEqual(noSuchUser.body);
});

test("a protected route rejects a missing token", async () => {
  const res = await api().post("/urls").send({ original_url: "https://example.com" });
  expect(res.status).toBe(401);
});

test("a protected route rejects a garbage token", async () => {
  const res = await api()
    .post("/urls")
    .set({ Authorization: "Bearer not-a-real-token" })
    .send({ original_url: "https://example.com" });
  expect(res.status).toBe(401);
});
