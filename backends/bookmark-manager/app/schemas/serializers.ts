// Response serializers. They project Prisma's camelCase rows onto the snake_case
// JSON shape the API contract (and the tests) expect, and crucially never leak
// password_hash.
//
// The return types are written out rather than inferred, because these are the
// API's public contract. Naming them means a change to a Prisma model shows up
// here as a compile error instead of quietly changing the JSON clients receive.

import type { Prisma, Bookmark, Category, Tag, User } from "../generated/prisma/index.js";

interface TagPublic {
  id: number;
  name: string;
}

function tagPublic(tag: Tag): TagPublic {
  return { id: tag.id, name: tag.name };
}

interface UserPublic {
  id: number;
  email: string;
  username: string;
  is_active: boolean;
}

function userPublic(user: User): UserPublic {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    is_active: user.isActive,
  };
}

interface CategoryPublic {
  id: number;
  name: string;
  description: string | null;
}

function categoryPublic(category: Category): CategoryPublic {
  return {
    id: category.id,
    name: category.name,
    description: category.description,
  };
}

interface BookmarkPublic {
  id: number;
  url: string;
  title: string;
  description: string | null;
  favorite: boolean;
  click_count: number;
  category_id: number | null;
  created_at: Date;
  updated_at: Date;
  tags: TagPublic[];
}

// A bookmark row that may or may not have had its tags loaded. Prisma generates
// a payload type per include shape, which is what says "tags is there" at the
// type level instead of hoping the caller remembered the include.
type BookmarkWithTags = Prisma.BookmarkGetPayload<{ include: { tags: true } }>;

function bookmarkPublic(bookmark: Bookmark | BookmarkWithTags): BookmarkPublic {
  const tags = "tags" in bookmark ? bookmark.tags : [];
  return {
    id: bookmark.id,
    url: bookmark.url,
    title: bookmark.title,
    description: bookmark.description,
    favorite: bookmark.favorite,
    click_count: bookmark.clickCount,
    category_id: bookmark.categoryId,
    created_at: bookmark.createdAt,
    updated_at: bookmark.updatedAt,
    tags: tags.map(tagPublic),
  };
}

interface TokenResponse {
  access_token: string;
  token_type: string;
}

function tokenResponse(accessToken: string): TokenResponse {
  return { access_token: accessToken, token_type: "bearer" };
}

export {
  tagPublic,
  userPublic,
  categoryPublic,
  bookmarkPublic,
  tokenResponse,
};
export type {
  TagPublic,
  UserPublic,
  CategoryPublic,
  BookmarkPublic,
  BookmarkWithTags,
  TokenResponse,
};
