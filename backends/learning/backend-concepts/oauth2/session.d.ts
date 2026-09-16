// express-session type augmentation for this folder.
//
// express-session types req.session as SessionData, which it expects you to
// widen with whatever your app stores. Both scripts here keep the OAuth CSRF
// state on the session, and 02_github also keeps a minimal GitHub profile, so
// the two fields are declared once here rather than cast at each use.
//
// Be aware this augmentation is program-wide, not file-scoped: every module in
// the repo sees these fields. That is fine when one shape serves everyone, as it
// does here. Where two apps needed a *different* shape for the same property —
// the two capstone backends and their `user` — the answer was a local
// `AppRequest extends Request` instead, because the global declarations would
// have merged and collided. See backends/*/app/request.ts.

import "express-session";

declare module "express-session" {
  interface SessionData {
    // CSRF state generated before redirecting to the provider, checked on the
    // way back, then deleted.
    oauthState?: string;
    // A minimal profile — never the access token.
    user?: {
      id: number;
      login: string;
      name: string;
      email: string | null;
      avatar_url: string;
    };
  }
}
