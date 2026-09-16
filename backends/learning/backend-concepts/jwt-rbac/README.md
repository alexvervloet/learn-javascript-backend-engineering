# JWT & RBAC

JSON Web Tokens for stateless authentication, and role-based access control on
top, using [`jsonwebtoken`](https://github.com/auth0/node-jsonwebtoken) + Express.

| File | What it teaches |
|---|---|
| `01_jwt_basics.ts` | Anatomy of a JWT; sign/verify; tampered, expired, wrong-secret rejection |
| `02_auth_flow.ts` | Login → token → `Authorization: Bearer`; auth middleware |
| `03_rbac.ts` | `requireRole(min)` middleware factory; 401 vs 403 |
| `04_refresh_tokens.ts` | Short access + long refresh tokens, rotation, server-side revocation |

## Run

```bash
npm install            # from the repo root (jsonwebtoken, express)
npx tsx 01_jwt_basics.ts  # standalone demo
npx tsx 02_auth_flow.ts   # starts an Express server on :8000
```

```bash
curl -sX POST localhost:8000/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"secret"}'
curl localhost:8000/me -H 'Authorization: Bearer <token>'
```

