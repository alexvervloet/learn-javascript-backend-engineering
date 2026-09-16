// Zod request schemas + response serializers. Input keys stay snake_case to
// match the JSON the API accepts/returns.

import { z } from "zod";

import type { Url, User } from "./generated/prisma/index.js";

const urlCreate = z.object({
  original_url: z
    .string()
    .refine((v) => v.startsWith("http://") || v.startsWith("https://"), {
      message: "URL must start with http:// or https://",
    }),
  custom_code: z
    .string()
    .nullish()
    .refine((v) => v == null || (/^[a-zA-Z0-9]+$/.test(v) && v.length >= 3 && v.length <= 10), {
      message: "Custom code must be 3–10 alphanumeric characters",
    }),
  expires_at: z.coerce.date().nullish(),
});

const registerRequest = z.object({
  username: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8),
});

// z.infer turns a schema into the type its output has. The schema stays the one
// source of truth: change a field and every handler reading it stops compiling.
type UrlCreate = z.infer<typeof urlCreate>;
type RegisterRequest = z.infer<typeof registerRequest>;

interface UrlResponse {
  id: number;
  short_code: string;
  original_url: string;
  short_url: string;
  created_at: Date;
  expires_at: Date | null;
  click_count: number;
  is_active: boolean;
}

function urlResponse(url: Url, baseUrl: string): UrlResponse {
  return {
    id: url.id,
    short_code: url.shortCode,
    original_url: url.originalUrl,
    short_url: `${baseUrl}/${url.shortCode}`,
    created_at: url.createdAt,
    expires_at: url.expiresAt,
    click_count: url.clickCount,
    is_active: url.isActive,
  };
}

interface UrlStats {
  short_code: string;
  original_url: string;
  click_count: number;
  created_at: Date;
  expires_at: Date | null;
  is_active: boolean;
}

function urlStats(url: Url): UrlStats {
  return {
    short_code: url.shortCode,
    original_url: url.originalUrl,
    click_count: url.clickCount,
    created_at: url.createdAt,
    expires_at: url.expiresAt,
    is_active: url.isActive,
  };
}

interface TokenResponse {
  access_token: string;
  token_type: string;
}

function tokenResponse(accessToken: string): TokenResponse {
  return { access_token: accessToken, token_type: "bearer" };
}

interface UserResponse {
  id: number;
  username: string;
  created_at: Date;
}

function userResponse(user: User): UserResponse {
  return { id: user.id, username: user.username, created_at: user.createdAt };
}

export {
  urlCreate,
  registerRequest,
  urlResponse,
  urlStats,
  tokenResponse,
  userResponse,
};
export type {
  UrlCreate,
  RegisterRequest,
  UrlResponse,
  UrlStats,
  TokenResponse,
  UserResponse,
};
