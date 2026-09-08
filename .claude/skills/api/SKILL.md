---
name: api
description: Change a Cloudflare Function, db/schema.sql, wrangler.toml, or anything that reads or writes the D1 database.
---

# Change a Function or the database

Everything under `functions/`, `db/schema.sql` and `wrangler.toml`. The
Functions run on the Workers runtime against a D1 database whose rows are
other people's, so this is the one process with steps that cannot be undone,
and the one where a mistake is quiet: the map still draws, and nobody notices
for weeks.

`.claude/rules/leave-it-better.md` loads itself when you open a file here.
`functions/api/lists.js` and `functions/api/account.js` are over the
~600-line mark, so the reach there is the functions you touch plus what they
call and what calls them.

## Read first

- The README section for the feature: **Saves**, **Accounts**, **Lists**,
  **Google venues**, **The directory**. Each says what is cached, what is
  deliberately not, and where a count comes from.
- **Two databases, and never one** and **Setting it up**, before anything
  that touches a binding, a secret or the schema.
- The header of the file, and of `functions/api/_lib.js`. The header of
  `lists.js` states the ownership rule every write in it follows.

## The routes

`_routes.json` sends everything except `/assets/*`, `/photos/*`,
`/stories/*`, `/data/*` and the favicon through the Functions. Files with a
leading underscore are modules, not routes.

| Route | File | Writes | Cache |
|---|---|---|---|
| `/*` | `_middleware.js` | none; 301s `pages.dev` to `tallinntastebuds.ee` | as `_headers` |
| `GET /api/saves` | `saves.js` | none | `public, max-age=60`, weak ETag, plus the edge cache under `countsKey()` |
| `POST /api/saves` | `saves.js` | `saves`, then `RECOUNT_SQL`, in one `batch()`; purges the counts cache | `no-store` |
| `GET/POST /api/account` | `account.js` | `users`, `sessions`, `login_fails`; `claim()` moves device saves onto the user and recounts | `no-store`, `Set-Cookie ttb_s` |
| `GET/POST /api/lists` | `lists.js` | `lists`, `list_items`, `list_keeps`, `added_places` | `no-store`, on purpose: the owner reads it mid-edit |
| `GET /api/places` | `places.js` | none; `data/places.json` merged with open `google_venues` | `public, max-age=300` |
| `GET /api/venues` | `venues.js` | none; the whole `google_venues` table | `public, max-age=300` |
| `GET /api/geocode` | `geocode.js` | none; proxies Photon, cached upstream a day | `no-store` |
| `/list/<id>` | `list/[id].js` | none; `lists.html` with the list unfurled | `no-store` |
| `/lists/kept` | `lists/kept.js` | none; `lists.html` with the first page of everybody's lists seeded in | `no-store` |

Both of those two serve the same `lists.html` with a head of their own, and
the escaping, head swap and seeding they share are in `functions/_shell.js` —
a module, so it is not a route either.

`json(body, status, maxAge)` in `_lib.js` is how every answer is built: with
`maxAge` it is `public, max-age=N`, without it `no-store`. **Never put a
session-gated answer behind a `maxAge`**; the directive is public.

## How the Functions are written

**Modern ESM.** `const`, arrows, `async`/`await`, top-level `import`. The
opposite dialect to `assets/`; do not carry either into the other.

**Two databases, and the split is load-bearing.** `wrangler.toml` declares
`tallinntastebuds-preview` at the top level (what `wrangler pages dev` reads)
and again under `[env.preview]`, and `tallinntastebuds` under
`[env.production]`, each with an `ENVIRONMENT` var equal to its block's
name. Both blocks must list every binding: Pages does not inherit from the
top level once an environment overrides anything. `wrongDatabase()` in
`_lib.js` reads `meta.environment` once per isolate and blocks only a
**disagreement** — `stamp !== '' && stamp !== expected` — so an unstamped
database or an unset var passes unguarded. The validator fails on a missing
env block, a block with no database or no `ENVIRONMENT`, or preview and
production sharing an id or a name.

**What each route needs, and what happens without it:**

| Missing | Effect |
|---|---|
| `DB` binding | counts `{}` 200; account and lists GET report `ready: false`; every POST `503 no-database`; venues 503; places serves the map's roll alone |
| `ENVIRONMENT` mismatch | the same answers as no database, `wrong-database` |
| `SAVE_SALT` | saves, account and lists POST **fail closed**, `503 no-salt`, rather than store a weaker hash. Changing it later resets every cap and leaves the counts alone |
| `TURNSTILE_SECRET` | optional; set, a save without a token is 403 |

Secrets live in the Pages dashboard, per environment, and never in the repo.

**Every write is a prepared statement, and every write to a list is
preceded by a read of `lists.owner`**: `onRequestPost` in `lists.js` loads
`owner, public` for the id and returns 404 unless it matches the session,
before `edit`, `delete`, `add`, `say`, `drop` or `order` run. The one
deliberate exception is `keep()`, routed above that check, which requires
the list to exist and be public and writes only a `list_keeps` row keyed on
the session's own id. Keep the header true when you change this.

**A count is recomputed, never nudged.** Anything that changes `saves` runs
`RECOUNT_SQL` in the same `batch()` and purges
`caches.default.delete(countsKey(request))`; the purge reaches one colo and
the 60-second TTL is the backstop.

**Every failure is quiet on the page.** Nothing in `assets/` waits on
`/api/*`, and a new route keeps that promise.

**`.claude/settings.json` carries hard denials**: never `DROP` a table,
never `DELETE` or `UPDATE` without a `WHERE`. There is no backup of either
database in this repository; D1 Time Travel's 30 days is the only recovery.

**Caps live in two places** and the server is the one that binds. `MAX_TITLE
60`, `MAX_INTRO 200`, `MAX_SAY 280`, `MAX_ITEMS 20` in `lists.js` are restated
at `assets/lists.js:54-57`; `MAX_NAME 80` and `MAX_ADDRESS 120` as literal
`maxlength`s at lines 1933 and 1942; the username's 3–24 in `account.js` as a
`maxlength` in `app.js`. Change one, change the other, and the README's table
under **The caps**.

## The schema

`db/schema.sql` is the schema, not a migration: every statement is `IF NOT
EXISTS`, and **nothing in CI applies it**. It is applied by hand, to both:

```
wrangler d1 execute tallinntastebuds         --remote --file=db/schema.sql
wrangler d1 execute tallinntastebuds-preview --remote --file=db/schema.sql
```

So a push does not apply it, and what is deployed and what is described can
part company: `idx_saves_owner` existed in production before it was in the
file, and `added_places.address` was added by a hand-run `ALTER TABLE`. A
change that adds a table or an index goes to preview first, is driven there,
and the PR says in so many words that production needs it applied on
landing. A change to an existing column has no runner: write the `ALTER`
out, run it on preview, say what it does to the rows, and list the columns
in the file in the order the deployed table has them. A foreign key on a
live table is a rebuild; do not reach for one.

## The steps

1. Make the change with the README section open and the file's header
   re-read against what the code now does.
2. `node tools/validate.mjs`. It checks `wrangler.toml`, the `KITCHENS`
   patterns in `venues.js` against the export, and the generated SQL.
3. **Drive it under `npx wrangler pages dev .`**, at `127.0.0.1:8788`, which
   reads the top of `wrangler.toml` and so hits the preview database. Never
   production, and never by pointing a binding at it. `.wrangler/` is the
   dev server's scratch and is ignored.
4. Rewrite the README paragraph the change made wrong, and the header.
5. The pass in `leave-it-better.md`.

## The commit

> Counts come from a counts table, not a `COUNT(*)` on every read
> A save is free again, and the account is the offer
> Merge the map into the directory, and read the week through one parser

The body says what the rows looked like before, what they look like after,
what it costs per request, and what has to be applied by hand and where.

## The pull request

1. `git fetch origin claude/tallinn-tastebuds-map-nzoqx0 && git rebase origin/claude/tallinn-tastebuds-map-nzoqx0`
2. `node tools/validate.mjs`. If `db/schema.sql` changed, apply it to
   **preview** now — `wrangler d1 execute tallinntastebuds-preview --remote
   --file=db/schema.sql` — so the preview deployment has the table the code
   expects.
3. `npx wrangler pages dev .` against the preview database, and the page
   half driven in a browser through it.
4. Commits that stand alone, subjects about what the rows or the answer now
   are.
5. `git push -u origin <branch>`, or `--force-with-lease` after a rebase.
6. Open the PR against the default branch. The body says what the rows
   looked like before and after, what it costs per request, and **what has
   to be applied by hand on landing and to which database** — the schema
   statement, the meta stamp, a load. A `wrangler.toml` change to the
   preview block only takes effect once a preview has deployed with it, and
   pushing the branch is what deploys one — Cloudflare's Git connection puts
   the URL in the PR's checks — so open that preview and say that you
   looked at what it deployed.
7. CI green, then **Rebase and merge**, delete the branch, and **apply to
   production** whatever the body said, immediately: the code is live the
   moment the push lands, and a route that expects a column production does
   not have fails quietly, which is the worst way.

## Where it goes wrong

- One D1 binding declared at the top level of `wrangler.toml` and handed to
  both environments, so a bookmark pressed on a preview was a save on the
  live map. Nobody noticed for weeks.
- A schema change pushed and never applied, so `pages dev` worked and the
  deployment did not.
- A preview binding changed in `wrangler.toml` and not picked up, because
  each environment's configuration is written by a deployment *of that
  environment*: open a PR, or run the workflow from a non-production branch.
- Comments that fell behind the routes: the README's "the attack surface of
  the database is that one file" was true when `saves.js` was alone, and the
  header of `_lib.js` still names three routes of seven. Fix the one you are
  standing in.
