/**
 * Factory helpers for building test rows.
 *
 * Each returns a callable bound to a db handle that creates a row with sensible
 * defaults, overridable per call. Plain functions, no fixture injection magic.
 */

import * as repository from "./repository.js";
import type { DatabaseType, UserRow, PostRow } from "./db.js";

interface UserOverrides {
  username?: string;
  email?: string;
}

interface PostOverrides {
  title?: string;
  body?: string;
  published?: boolean;
}

type UserFactory = (overrides?: UserOverrides) => UserRow;
type PostFactory = (user: UserRow, overrides?: PostOverrides) => PostRow;

function makeUserFactory(db: DatabaseType): UserFactory {
  return ({ username = "alice", email }: UserOverrides = {}) =>
    repository.createUser(db, username, email ?? `${username}@example.com`);
}

function makePostFactory(db: DatabaseType): PostFactory {
  return (
    user: UserRow,
    { title = "Test Post", body = "Body content.", published = false }: PostOverrides = {}
  ) => repository.createPost(db, user, title, body, published);
}

export { makeUserFactory, makePostFactory };
export type { UserOverrides, PostOverrides, UserFactory, PostFactory };
