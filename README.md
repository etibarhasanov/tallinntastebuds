# Tallinn Tastebuds — the map

A full-screen map of the places in Tallinn I have eaten at and approved for
[@tallinntastebuds](https://www.instagram.com/tallinntastebuds/). Tap a pin,
read the write-up, watch the reel. Live at
[tallinntastebuds.ee](https://tallinntastebuds.ee).

I give no scores, stars or rankings to my places, and I never will. Being on
the map is the verdict. Where Google's numbers appear, they say they are
Google's.

This file is the front door. The full reference — what counts as a
Restaurant, how discounts work at the table, why every decision was made —
is [`docs/handbook.md`](docs/handbook.md). Its `## ` headings are its table
of contents, and the code comments point into it by section name.

## What is here

- **The map** — eighty places in eleven languages, filtered by fourteen
  types, each with a write-up, photos and a reel. Google's directory of the
  other ~1,100 places in the city sits behind it.
- **Discover** — what a phone opens on, with the map one press away.
- **Saves and lists** — keep a place, make a top ten under your own name and
  send the link. Saving needs no account; a list does.
- **Profiles, stories, discounts and the blog** — members' pages, short-lived
  stories, discounts shown at the table, and posts about where to eat.
- **Ask** — a chat that answers with places from the map.
- **Flashcards** — Estonian decks, lessons and songs on
  `flashcard.tallinntastebuds.ee`.
- **The owner's pages** under `/admin/` — which places get opened, who comes,
  how they found the site.

## Ask your AI assistant

The map and the public lists can be read by Claude, ChatGPT or any assistant
that takes an MCP connector. Add this as a custom connector — no key, no
sign-in:

```
https://tallinntastebuds.ee/mcp
```

The flashcards have their own at `https://flashcard.tallinntastebuds.ee/mcp`.
Both read and never write. **Read by an assistant** in the handbook has the
details.

## Build on it

The map and the public lists are a public API too — `GET`, JSON, no key, any
origin — and the map can be put on your own page in an `<iframe>`:

```
https://tallinntastebuds.ee/api/v1/places?type=bakery
https://tallinntastebuds.ee/embed?list=<list id>
```

`https://tallinntastebuds.ee/developers` has every address. Version 1 only
ever gains fields; a break is `/api/v2`, beside it. **The public API** and
**The map on your site** in the handbook have the details.

## How it is built

Static files, fifty-six Cloudflare Functions, a Cloudflare D1 database and a
Workers AI binding for the chat. **No build step and no `npm install`**: the
files in the repo are the files that get served, and every tool in `tools/` is
zero-dependency Node.

| Where | What |
|---|---|
| `index.html`, `*.html` | the pages |
| `assets/` | browser JavaScript (ES5, served raw) and CSS |
| `data/` | the places, languages, discounts, stories and decks, as JSON |
| `photos/`, `stories/`, `clips/` | media |
| `functions/` | the Cloudflare Functions behind `/api/`, `/api/v1/`, `/mcp` and the pages that are written on the server |
| `db/` | `schema.sql` and the generated loads for D1 |
| `tools/` | generators and the validator |
| `exports/` | the Google Places export |
| `docs/handbook.md` | the full reference |
| `CLAUDE.md`, `.claude/` | how a Claude Code session works here, and a skill per kind of change |

Everything the map draws — places, write-ups, discounts, stories — is a JSON
file in this repo, and the map renders with the database switched off. Only
saves, lists, accounts and counts live in D1.

## Run it locally

Browsers refuse `fetch()` over `file://`, so serve the folder:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. For the Functions and the database, use
Wrangler instead — it runs D1 as a local copy under `.wrangler/state`:

```bash
npx wrangler d1 execute tallinntastebuds-preview --local --file=db/schema.sql
```

```bash
npx wrangler pages dev .
```

## Add a place

Add an object to `data/restaurants.json` — **Add a place** in the handbook has
every field — put its photos in `photos/<id>/`, then:

```bash
node tools/generate.mjs
```

```bash
node tools/validate.mjs
```

Or use `/admin.html`, which does the same and lands it on its own.

## Before you push

`node tools/generate.mjs` rewrites everything generated (cache stamps, the
per-language files, the sitemap, the SQL loads). Then the checks CI runs:

```bash
node tools/validate.mjs && node tools/functions-check.mjs && node tools/sqlcheck.mjs && node tools/qrperf.mjs --check && node tools/chessperf.mjs --check && node tools/mcpcheck.mjs --check && node tools/apicheck.mjs --check && node tools/routecheck.mjs --check && node .claude/hooks/d1-write-gate.mjs --check
```

All need Node 22 or newer and nothing else — 22 for `node:sqlite`, which
`tools/sqlcheck.mjs` builds its database with. There is no test suite.

## Deploys

The default branch, `claude/tallinn-tastebuds-map-nzoqx0`, is the live site:
Cloudflare Pages deploys every push to it within the minute. No other branch
deploys anything. Work lands through a pull request with **Rebase and merge**.

Production `tallinntastebuds` is the only database that is kept. Every write
to it — a schema change, a `.sql` load — is applied by hand and asked for
first. **What needs a yes** in `CLAUDE.md` is the rule.
