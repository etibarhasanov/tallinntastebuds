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
`functions/api/lists.js` and `functions/api/ask.js` are over the ~600-line
mark (`wc -l functions/api/*.js` is the current answer), so the reach there
is the functions you touch plus what they call and what calls them.

## Read first

- The README section for the feature: **Saves**, **Accounts**, **The
  account page**, **Lists**, **Profiles**, **Google venues**, **The
  directory**, **The pins**, **Ask for somewhere**. Each says what is cached, what is
  deliberately not, and where a count comes from. `grep -n '^## ' README.md`
  is the table of contents with line numbers.
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
| `/*` | `_middleware.js` | none; 301s `pages.dev` to `tallinntastebuds.ee`, and — **splitwise**, in a fenced block — serves `split.html` at the root of `splitwise.tallinntastebuds.ee` while 301ing every other path on that host back to the site | as `_headers` |
| `GET /api/saves` | `saves.js` | none | `public, max-age=60`, weak ETag, plus the edge cache under `countsKey()` |
| `POST /api/saves` | `saves.js` | `saves`, then `RECOUNT_SQL`, in one `batch()`; purges the counts cache | `no-store` |
| `GET/POST /api/account` | `account.js` | `users`, `sessions`, `login_fails`, `username_holds`, `identities`; `claimDeviceSaves()` moves device saves onto the user and recounts, `username-change` releases the old name into a thirty-day hold, `about` writes the profile line — the one change here that asks for a session and not the password — and `google-name` makes the account a Google sign-in landed on | `no-store`, `Set-Cookie ttb_s` |
| `GET /api/google` | `google.js` | `users`, `sessions`, `identities`, and the saves `claimDeviceSaves()` moves. **One route asked twice**: with nothing it redirects to Google, with Google's `?code=` it is the way back — so there is one redirect URI to register per hostname rather than a pair to keep in step. Never answers JSON; every ending is a 302 to the `?then=` it was given, carrying one word in `?google=`. Off entirely without `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, and then every sheet draws the username and password alone | `no-store`, `Set-Cookie ttb_s`, `ttb_g`, `ttb_gp` |
| `GET/POST /api/lists` | `lists.js` | `lists`, `list_items`, `list_keeps`, `added_places` | `no-store`, on purpose: the owner reads it mid-edit |
| `GET /api/places` | `places.js` | none; `data/places.json` merged with open `google_venues` | `public, max-age=300` |
| `GET /api/venues` | `venues.js` | none; the whole `google_venues` table | `public, max-age=300` |
| `GET /api/geocode` | `geocode.js` | none; proxies Photon for the add-a-place form, session required, cached a day; its `suggest()` is also what `/api/ask` measures "near" from | `no-store` |
| `GET /api/profile` | `profile.js` | none; one person's public lists and their keep total | `no-store` |
| `GET /api/pass` | `pass.js` | none; the door in front of every discount — `401` where there is no session, so `deal.html` offers the sign-in sheet instead of a code — carrying one number for the account, the place named by `?r=` and this hour, an HMAC under `SAVE_SALT`, which `assets/pass.js` counts up the run of a deal with a roll | `no-store` |
| `/split` | `split.js` | **splitwise** — none; `split.html` with the group named by `?g=` written into its head, so a pasted link unfurls as the group. `functions/_middleware.js` calls it for the subdomain's root too | `no-store`, `noindex` |
| `GET/POST /api/split` | `api/split.js` | **splitwise** — `split_groups`, `split_members`, `split_expenses`, `split_shares`, `split_settlements`. **Reading one group needs only its code**, no session — holding the link is the permission, see `groupById()`. **Every write needs a session and a membership**: each action but `create` and `join` reads the caller's own membership first, and a non-member is told the group does not exist | `no-store`, for the reason `lists.js` is |
| `POST /api/ask` | `ask.js` | none; narrows the two rolls to what a question could be about and puts it to Workers AI; measures "near" from the place named through `geocode.js`, or from the visitor's own dot sent as `here` | `no-store` |
| `/list/<id>` | `list/[id].js` | none; `lists.html` with the list unfurled | `no-store` |
| `/lists` | `lists/index.js` | none; `lists.html` with the first page of everybody's lists seeded in — with the five Google lists as `start`, and each row's places as `dots` — searched when the address carries `?q=`, ordered by `?sort=` (`kept`, `new`, `changed`) | `no-store` |
| `/lists/public` | `lists/public.js` | none; 301 to `/lists`, the address this page had before it was shortened | — |
| `/lists/kept` | `lists/kept.js` | none; 301 to `/lists`, the address it had before that | — |
| `/u/<name>` | `u/[name].js` | none; `lists.html` with the profile seeded in | `no-store` |

Those three pages serve the same `lists.html` with a head of their own, and
the escaping, head swap and seeding they share are in `functions/_shell.js`.
The query each seeds is in a module beside the route that also answers it —
`_lists.js` for one list, `_mostkept.js` for everybody's, `_profile.js` for
one person — so the page and the API cannot drift apart. Underscore-prefixed
files are modules, never routes.

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
| `SAVE_SALT` | saves, account and lists POST **fail closed**, `503 no-salt`, rather than store a weaker hash, and so does `/api/pass`, whose answer is a hash under it — which takes every discount down with it, deliberately. Changing it later resets every cap, leaves the counts alone, and redraws every rolled discount from that hour on |
| `TURNSTILE_SECRET` | optional; set, a save without a token is 403 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional, and both or neither. Without the pair `/api/account` answers `google: false`, every sheet draws the username and password alone, and `/api/google` sends a hand-typed request home. Nothing else changes |
| `AI` binding | `/api/ask` answers `source: "none"`, `note: "no-ai"`, and the chat says nothing on the map answers. Everything else is untouched |

Secrets live in the Pages dashboard, per environment, and never in the repo.

**The chat is Workers AI and only that.** `[ai]` in `wrangler.toml` is a
binding like `DB`, not a key: nothing to create, nothing to buy, the model
is the one `MODEL` constant at the top of `ask.js`. Three things about it
bite. The free allowance is **ten thousand Neurons a day per account, shared
by preview and production**, so an afternoon of driving the chat on a
preview empties the live site's day; past it every request is a 429 until
midnight UTC and the chat says it is resting. The model answers as a chat
completion, words at `choices[0].message.content`, and an older model
answers `{ response }` — the route reads both, because reading one cost a
year of the model never being heard. And `/api/ask` says which half
answered in `note` — `workers-ai`, `workers-ai-none`, `workers-ai-spent`,
`no-ai` — so when the chat goes quiet, one request tells you why. The
model never writes about a place: it picks ids out of the slice it was
given and writes a clause each, and an id it invented is dropped. Keep
that shape; it is what makes a hallucinated restaurant unreachable.

**The Google round trip is `functions/api/_google.js` and
`functions/api/google.js`, and nothing else.** The module holds the two sealed
cookies, the code swap and the three queries against `identities`; the route
holds the trip. `account.js` imports from it and never talks to Google itself.
The scope asked for is `openid` alone — no address, no name, no picture — and
the only thing stored is Google's `sub`. An account made this way has an
**empty `pw_hash`**, and `matches()` in `account.js` is the one place that
knows what that means: it refuses a sign-in against one rather than deriving
PBKDF2 at nought iterations, which WebCrypto throws on. Read **Signing in with
Google** in `README.md` before changing any of it.

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

**A write to either database is the owner's decision, and there is a gate
that enforces it.** `.claude/hooks/d1-write-gate.mjs` runs before every
`d1_database_query` call: a read runs, and anything that writes — `INSERT`,
`UPDATE`, `DELETE`, any DDL, a generated `.sql` file pasted in — stops and
asks. Do not go around it, and do not read "merge it" as covering the load
that follows. **The rules of a write** below is the procedure.

`.claude/settings.json` also carries two hard denials: never `DROP` a table,
never `DELETE` or `UPDATE` without a `WHERE`. There is no backup of either
database in this repository; D1 Time Travel's 30 days is the only recovery.

**Caps live in two places** and the server is the one that binds. `MAX_TITLE
60`, `MAX_INTRO 200`, `MAX_SAY 280`, `MAX_ITEMS 50` in `lists.js` are restated
in `assets/lists.js`, and `MAX_TITLE` a third time in `assets/account.js`,
which carries the box that names a new list; `MAX_ABOUT 200` in `account.js`
is restated in `assets/account.js`, which carries the only box that writes it; `MAX_NAME 80` and
`MAX_ADDRESS 120` as literal `maxlength: '80'` and `'120'` in the add-a-place
form in `assets/lists.js`; the username's 3–24 in `account.js` as a
`maxlength: '24'` on all three of `app.js`'s username fields — the sign-up
sheet's, the rename step's and the one behind Continue with Google — and on
`split.js`'s, which is one field worn by three views, and in words as
`accountUsernameHint` and `accountErrUsername` in `data/ui.json`. `grep -n maxlength assets/*.js` finds every
copy. Change one, change the other, and the README's table under **The
caps**.

<<<<<<< HEAD
**And so does the pin table.** `PIN_GLYPHS` and `PIN_TONES` in
`functions/api/_pins.js` are the ids a list may store; `GLYPHS` and `TONES` in
`assets/pins.js` are the same ids plus the emoji each draws. Neither file can
import the other, so they are written out twice — the same arrangement the
story clock has. `node tools/validate.mjs` fails the build when they drift, so
this one is enforced rather than remembered. `mark` is in neither, on purpose:
the mouth goes on a place I have eaten at and a picker must not be able to
hand it out. **The pins** in `README.md`.
=======
`MAX_ITEMS` is the one of them with a third reader: `tools/validate.mjs`
imports it from `lists.js` — the only thing in `tools/` that imports a route —
and fails on a generated list in `db/type-lists.sql` longer than it. That is
not a copy and needs no moving, but it does mean a lowered `MAX_ITEMS` fails
CI rather than going quiet. Casual/Solo is 45 of the 50.
>>>>>>> e32b3d7 (Every filter chip is a list, published under the map's own name)

## The rules of a write

Reading is free: `d1_database_query` answers a `SELECT` straight away, and
checking the state of a table is how everything here gets verified. Writing is
not, and the split is machinery rather than good intentions —
`.claude/hooks/d1-write-gate.mjs`, wired as a `PreToolUse` hook in
`.claude/settings.json`, classifies the SQL and hands back `allow` or `ask`.
Its cases live in the file it guards and CI runs them (`--check`).

The procedure around it, which no hook can enforce and you have to:

1. **Work out the delta first, from the databases themselves.** Compare what
   is in them against what the repository says should be — row counts, a
   `GROUP BY`, per-column aggregates — rather than assuming the last load
   landed. Something else may have been applied since, and a column you are
   not touching may have moved.
2. **Say what will change before asking to change it**: which database, which
   table, which columns, how many rows, and what the values go from and to.
   A count on its own is not a description. Group them where there are many —
   "49 rows, American → Burgers" — and name the ones a person would want to
   check by eye.
3. **Keep it inside the cap.** A write names its rows — an `INSERT` with its
   tuples written out, or a `WHERE` that pins every primary-key column with
   `=` or `IN (…)` — and names at most **a hundred** of them across the whole
   call, with **twenty** the size an ordinary correction should be. The gate
   refuses the rest rather than prompting: over a hundred, and anything whose
   size is not in the statement (`WHERE cuisine = 'American'`, a `LIKE`, a
   range, a subquery, a table not in `db/schema.sql`). That is not a wall to
   climb. A load bigger than the cap is a terminal job — the two
   `wrangler d1 execute` lines in this file and in `/google-venues` — and a
   sweep whose size nobody can state is a sweep nobody should run.
4. **Then let the prompt happen**, and take a no for an answer. One ask per
   write; asking again in the same turn hoping for a different answer is not
   how consent works.
5. **Preview first, production after**, verified the same way against each.
   They are separate databases, and a yes for one is not a yes for the other
   unless that is what was said.
6. **Verify after**, as in step 1, and say what the numbers are now.

"Merge it", "land it", "ship it" and "fix it" are about the pull request. The
database is a second yes and it is worth asking for plainly: the change is in
the repository either way, and an unloaded `.sql` file is something anybody
can apply in a minute. A load that happened without being asked for cannot be
unhappened.

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
in the file in the order the deployed table has them. **And make the readers
survive its absence**, because there is always an afternoon between the deploy
and somebody running it: `users.about` does that with a try and a second
statement, and `lists.pin` with `readingPins()` in
`functions/api/_pins.js`, which asks once per isolate and then knows.
A foreign key on a live table is a rebuild; do not reach for one.

## The steps

1. Make the change with the README section open and the file's header
   re-read against what the code now does.
2. `node tools/validate.mjs`. It checks `wrangler.toml`, the `KITCHENS`
   patterns in `venues.js` against the export, and the generated SQL.
3. **Drive it under `npx wrangler pages dev .`**, at `127.0.0.1:8788`, which
   reads the top of `wrangler.toml` and so hits the preview database. Never
   production, and never by pointing a binding at it. `.wrangler/` is the
   dev server's scratch and is ignored. The `AI` binding runs remotely even
   there and spends from the shared daily allowance, so drive the chat a
   few questions at a time. To look at rows without a dev server, the
   Cloudflare MCP tool `d1_database_query` reads either database without a
   prompt and writes to neither without one — see **The rules of a write**.
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
7. CI green, then **Rebase and merge** — the branch stays, `CLAUDE.md` says
   why — and **apply to production** whatever the body said, immediately:
   the code is live the moment the push lands, and a route that expects a
   column production does not have fails quietly, which is the worst way.

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
  header of `_lib.js` named three routes of eight for a month. Fix the one
  you are standing in, and count the routes in this file's table when you
  add one.
- The chat driven hard on a preview, and the live site out of model until
  midnight UTC. Same allowance, one account.
