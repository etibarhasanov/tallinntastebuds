---
name: api
description: Change a Cloudflare Function, db/schema.sql, wrangler.toml, or anything that reads or writes the D1 database.
---

# Change a Function or the database

Everything under `functions/`, `db/schema.sql` and `wrangler.toml`: the save
counts, accounts, lists, the places roll, the Google directory, and the
middleware that sends the `pages.dev` address home. These run on the Workers
runtime against a D1 database whose rows are other people's, so this is the
one process with things in it that cannot be undone.

Read `leave-it-better.md` as well; `functions/api/lists.js` and
`functions/api/account.js` are both over the ~600-line mark, so the reach
there is the functions you touch plus what they call and what calls them.

## Read first

- The README section for the feature: **Saves**, **Accounts**, **Lists**,
  **Google venues**, **The directory**. Each has a subsection on what is
  cached and what is deliberately not, and on where a count comes from.
- **Two databases, and never one** and **Setting it up**, before anything
  that touches a binding, a secret or the schema.
- The header block of the file, and of `functions/api/_lib.js`, which is what
  the routes share. `lists.js`'s header states the ownership rule every write
  in it follows.

## How the Functions are written

**Modern ESM.** `const`, arrows, `async`/`await`, top-level `import`. The
opposite dialect to `assets/`; do not carry either into the other.

**Two D1 databases, and the split is load-bearing.** `tallinntastebuds` for
production, `tallinntastebuds-preview` for every preview deployment and for
`wrangler pages dev`. Each deployment carries an `ENVIRONMENT` var out of
`wrangler.toml` that `wrongDatabase()` in `_lib.js` compares against the
database's own `meta` row, so a binding pointed at the wrong one shuts the
whole API off rather than writing to it. `tools/validate.mjs` refuses to let
the two ids in `wrangler.toml` drift back together. The preview database is
not kept in step with production and is not meant to be; if its data gets in
the way, empty it.

**Secrets** — `SAVE_SALT`, `TURNSTILE_SECRET`, the mail tokens — live in the
Pages dashboard, per environment, and never in the repo. The save endpoint
refuses to write without its salt rather than store a weaker hash than it
claims to; a new route that needs a secret fails closed the same way.

**Every write is a prepared statement, and every write to a list is preceded
by a read of `lists.owner`.** The one deliberate exception — keeping somebody
else's list — does its own narrower check. That rule is in `lists.js`'s
header; keep it true, and keep the header true.

**`.claude/settings.json` carries hard denials for D1**: never `DROP` a
table, never `DELETE` or `UPDATE` without a `WHERE`. There is no backup of
either database in this repository. `added_places` holds no rows and is
referenced by nothing yet, and it is kept on purpose.

**Every failure is quiet.** If a route is missing, a binding is wrong or the
salt is unset, the counts do not appear and the map still draws. Nothing in
`assets/` waits on `/api/*`, and a new route keeps that promise.

## The schema

`db/schema.sql` is the schema, not a migration: every statement is `IF NOT
EXISTS`, and it is applied by hand to both databases —

```
wrangler d1 execute tallinntastebuds         --remote --file=db/schema.sql
wrangler d1 execute tallinntastebuds-preview --remote --file=db/schema.sql
```

— so a push does not apply it. A change that adds a table or a column is
applied to preview first and driven there, and the PR says in so many words
that production needs it applied on landing. A change to an existing column
is a migration this repo has no runner for; write the statement out, run it
on preview, and say what it does to the rows before anybody runs it on
production.

## The steps

1. Make the change, with the README section open and the file's header
   re-read against what the code now does.
2. `node tools/validate.mjs` — it checks `wrangler.toml` and the `KITCHENS`
   table in `venues.js` among everything else.
3. **Drive it under `wrangler pages dev`**, which runs the real bindings
   locally against the preview database. Never against production, and never
   by pointing a binding at it. For the page half of the change, `site.md`
   says how to drive it with the API stubbed.
4. Rewrite the README paragraph the change made wrong, and the header block.
5. The pass in `leave-it-better.md`.

## The commit

> Counts come from a counts table, not a `COUNT(*)` on every read
> A save is free again, and the account is the offer
> Merge the map into the directory, and read the week through one parser

The body says what the rows looked like before, what they look like after,
what it costs per request, and what has to be applied by hand and where.

## Where it goes wrong

- One D1 binding declared at the top level of `wrangler.toml`, handed to both
  environments, so a bookmark pressed on a preview was a save on the live
  map. Nobody noticed for weeks.
- A schema change is not deployed by a push. The PR has to say it needs
  applying, and to both databases.
