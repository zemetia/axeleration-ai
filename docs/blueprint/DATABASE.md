# Database & Auth

← [Blueprint INDEX](./INDEX.md)

---

## Stack

| Package | Version | Role |
|---|---|---|
| `prisma` | ^7.x | ORM CLI (dev) |
| `@prisma/client` | ^7.x | Generated query client (prod) |
| `@prisma/adapter-pg` | ^7.x | Prisma 7 driver adapter for PostgreSQL |
| `pg` | ^8.x | PostgreSQL node.js driver |
| `@auth/prisma-adapter` | ^2.x | Connects NextAuth to Prisma |
| `next-auth` | ^5 beta | Auth.js — session, JWT, providers |
| `bcryptjs` | ^3.x | Password hashing (pure JS, no native deps) |

---

## Modular Prisma Schema

All `.prisma` files live in `prisma/schema/`. Prisma 7 merges them automatically when `package.json` points to the folder.

```json
// package.json
"prisma": {
  "schema": "prisma/schema"
}
```

### Key config file

[`prisma.config.ts`](../../prisma.config.ts) — **Prisma 7 root config** (replaces the old `prisma.schema` key in `package.json`).

```ts
// prisma.config.ts
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: './prisma/schema',           // folder with *.prisma files
  datasource: { url: process.env.DATABASE_URL }, // for CLI (migrate/introspect)
  migrations: { seed: 'tsx prisma/seed.ts' },
});
```

> **Prisma 7 architecture change**: The `url` field is no longer in `schema.prisma`. The CLI reads it from `prisma.config.ts`; the PrismaClient reads it through the `@prisma/adapter-pg` driver adapter in `src/lib/prisma.ts`.

### Schema files

| File | Models |
|---|---|
| [`prisma/schema/base.prisma`](../../prisma/schema/base.prisma) | `generator client` + `datasource db` (no `url` — Prisma 7) |
| [`prisma/schema/user.prisma`](../../prisma/schema/user.prisma) | `User`, `UserRole` enum |
| [`prisma/schema/auth.prisma`](../../prisma/schema/auth.prisma) | `Account`, `Session`, `VerificationToken` |

### Adding a new domain model

Create `prisma/schema/<domain>.prisma`. Any relations to `User` should reference the `User` model by name — Prisma merges all files before validation.

```prisma
// prisma/schema/post.prisma
model Post {
  id        String   @id @default(cuid())
  title     String
  authorId  String
  author    User     @relation(fields: [authorId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("posts")
}
```

Also add the back-relation to `user.prisma`:
```prisma
model User {
  // ...existing fields
  posts Post[]
}
```

---

## Prisma Client Singleton

```ts
import { prisma } from '@/lib/prisma';
```

[`src/lib/prisma.ts`](../../src/lib/prisma.ts) — creates one `PrismaClient` per process (dev hot-reload safe via `globalThis`) using the `@prisma/adapter-pg` driver:

```ts
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });
```

**Never instantiate `new PrismaClient()` outside this file.** Never create a `Pool` directly in application code.

---

## `npm run db:*` Commands

| Script | Prisma command | When to use |
|---|---|---|
| `npm run db:generate` | `prisma generate` | After any schema change — regenerates the client |
| `npm run db:push` | `prisma db push` | Push schema to DB without a migration (prototype / dev only) |
| `npm run db:pull` | `prisma db pull` | Introspect existing DB and update schema |
| `npm run db:migrate` | `prisma migrate dev` | Create + apply a migration in development |
| `npm run db:migrate:deploy` | `prisma migrate deploy` | Apply pending migrations in CI/production |
| `npm run db:migrate:reset` | `prisma migrate reset --force` | Wipe DB + rerun all migrations (dev only) |
| `npm run db:studio` | `prisma studio` | Open the Prisma data browser |
| `npm run db:format` | `prisma format` | Format all `.prisma` files |
| `npm run db:seed` | `tsx prisma/seed.ts` | Run the seed script (create `prisma/seed.ts` first) |

---

## NextAuth (Auth.js v5)

### Entry points

| File | Export | Purpose |
|---|---|---|
| [`src/auth.ts`](../../src/auth.ts) | `handlers, auth, signIn, signOut` | Single config file — imported everywhere |
| [`src/app/api/auth/[...nextauth]/route.ts`](../../src/app/api/auth/%5B...nextauth%5D/route.ts) | `GET, POST` | HTTP handler — do not edit |
| [`src/lib/auth.ts`](../../src/lib/auth.ts) | `getSession, requireAuth, requireRole` | Server-side session helpers |
| [`src/types/auth.ts`](../../src/types/auth.ts) | type augmentations | Adds `id` + `role` to `Session` + `JWT` |

### Session strategy: JWT (default)

Sessions are stored in a signed/encrypted HTTP-only cookie — no database round-trip on every request. The `Session` table in Prisma is created but unused with JWT strategy.

Switch to `strategy: 'database'` in `src/auth.ts` if you need server-side session invalidation.

### Providers

The template ships with `Credentials` only. To add an OAuth provider:

```ts
// src/auth.ts
import GitHub from 'next-auth/providers/github';

providers: [
  GitHub,
  Credentials({ ... }),
],
```

Add the required env vars (`AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`) — Auth.js v5 auto-reads these by convention.

### Server-side usage

```ts
// Server Component or Route Handler
import { getSession, requireAuth, requireRole } from '@/lib/auth';

// Nullable — returns null if not signed in
const session = await getSession();

// Throws 'Unauthorized' if not signed in
const session = await requireAuth();

// Throws 'Forbidden' if role doesn't match
const session = await requireRole('ADMIN');

// Access user from session
session.user.id    // string
session.user.email // string | null | undefined
session.user.role  // string
```

### Client-side usage

```tsx
'use client';
import { useSession } from 'next-auth/react';

export function UserMenu() {
  const { data: session, status } = useSession();
  // status: 'loading' | 'authenticated' | 'unauthenticated'
}
```

Wrap client subtree that needs `useSession` with `<SessionProvider>` from `next-auth/react`. Mount it in `src/app/[locale]/layout.tsx` inside the provider tree.

### Sign-in / Sign-out (Server Actions)

```ts
import { signIn, signOut } from '@/auth';

// Inside a Server Action or Route Handler only
await signIn('credentials', { email, password, redirectTo: '/dashboard' });
await signOut({ redirectTo: '/' });
```

---

## Type Augmentation

[`src/types/auth.ts`](../../src/types/auth.ts) extends the NextAuth types to include `id` and `role` on every `session.user` object and JWT token. This file is automatically picked up by TypeScript since it lives in `src/types/`.

```ts
// next-auth module — adds id + role to session.user
declare module 'next-auth' {
  interface Session { user: { id: string; role: string } & DefaultSession['user'] }
  interface User { role?: string | null }
}

// @auth/core/jwt — note: use @auth/core/jwt, NOT next-auth/jwt (doesn't resolve in v5 beta)
declare module '@auth/core/jwt' {
  interface JWT { id?: string; role?: string | null }
}
```

---

## Password Hashing

Use `bcryptjs` (pure JS — no native compilation required):

```ts
import bcrypt from 'bcryptjs';

// Hash on register
const hashed = await bcrypt.hash(plainPassword, 12);

// Compare on sign-in (already done inside src/auth.ts authorize)
const valid = await bcrypt.compare(plainPassword, hashedPassword);
```

---

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | JWT signing + encryption key — `openssl rand -base64 32` |
| `AUTH_URL` | Prod | Canonical origin for redirects — defaults to `NEXT_PUBLIC_APP_URL` |

---

## Sign-in Page

`src/auth.ts` sets `pages.signIn = '/sign-in'`. With `localePrefix: 'always'` routing, the actual path is `/en/sign-in` / `/id/sign-in`. Update this to your localized route after scaffolding the sign-in page.

---

## File Creation Checklist — New Auth Feature

- [ ] Add Zod schema to [`src/lib/validations/auth.ts`](../../src/lib/validations/auth.ts)
- [ ] Create Server Action in `src/app/[locale]/<feature>/actions.ts` — call `prisma` directly, never in components
- [ ] Use `requireAuth()` or `requireRole()` from `@/lib/auth` at the top of protected Server Actions / Route Handlers
- [ ] For new OAuth providers: add to `providers[]` in [`src/auth.ts`](../../src/auth.ts) + env vars

---

← [Blueprint INDEX](./INDEX.md)
