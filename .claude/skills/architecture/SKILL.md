---
name: architecture
description: The shape of the site and why it is that shape — pages as documents, the map as the shell they open on, the two subdomains, globals instead of modules, where a new page or script goes. Use before changing how pages, scripts or hosts fit together, before proposing a new page or route, and for anything in assets/shell.js, assets/radio.js, functions/_security.js, functions/_middleware.js, _headers or _routes.json.
---

# The shape of the site

Where things stand in relation to each other, and the reasons, so that a
change to the joints between pages is made knowing what the joints are. The
feature skills say how to change a page; this says what a page *is* here,
and what it may lean on. Read it before a change that adds a page, a route,
a host, a shared script or a header, or that moves something from one of
those to another — and before proposing one, because most proposals of that
kind have an answer already written down below.

## Read first

- `CLAUDE.md` → **Orient in two minutes, not twenty**, **Branches and
  deploys**, and **Something new is described before it is built**. A new
  page or route is new, and gets described before it gets built.
- `README.md` → **The map is the shell**, **The radio**, **Splitwise** →
  *Why a subdomain*, **Flashcards** → *Why a subdomain, again*, **Getting
  found**, **The security headers**, **The build budget**. `grep -n '^## '
  README.md` is the table of contents with line numbers.
- The header block of `assets/shell.js` and of `assets/radio.js`: the two
  files that know a page can be inside another page.

## The shape, in one screen

```
tallinntastebuds.ee                 one Cloudflare Pages project, one Worker
│
├── /            index.html         THE MAP, and the shell every other page opens on
│                assets/app.js      twelve thousand lines; mounts TTBRadio and TTBShell
│
├── /lists /list/<id> /u/<name>     lists.html, one document, three Functions write its head
├── /account.html /edit /insights   account.html, edit.html, insights.html
├── /blog  ?post=                   blog.html, in-document between index and post
├── /write                          write.html, where a member writes a post for it
├── /flashcard  ?d=                 flashcard.html, in-document between decks and a deck
├── /chess                          chess.html
├── /feedback                       feedback.html
├── /deal /verify /staff            the three pass pages, no-store
├── /privacy                        privacy.html, its text written in by functions/privacy.js per language
├── /404                            static, what Pages serves for an address nothing answers
├── /admin.html /admin/*            the owner's, never framed, 404 to anybody else
│
├── /api/*       functions/api/     JSON; every answer leaves through _middleware.js
│                                   wearing functions/_security.js
│
├── splitwise.tallinntastebuds.ee   split.html at the root; its own site to a browser
└── flashcard.tallinntastebuds.ee   flashcard.html at the root; the same page as /flashcard
                                    on a different origin — no ttb.lang, no radio carried
```

Two databases, production and preview, bound in `wrangler.toml`; only
production is kept — `CLAUDE.md` → **Production only, for now**. One Workers
AI binding for the chat. No build step, no `package.json`, no bundler, no
test runner, by decision — `CLAUDE.md` says which decision each is.

## Pages are documents, and the map is the shell

**Every page is a whole document with its own script**, served at its own
address, loadable on its own, indexable where it should be. That is what
makes a link shareable, a middle click work, a crawler read the flashcards,
and a page removable by deleting its files — **Taking it out** under
**Splitwise** is that argument in full and it holds for every page.

**A walk that starts on the map does not leave the map.** `assets/shell.js`
opens the page in an `<iframe>` inside `#shell`, a full-screen surface over
the map, and the map stays underneath — pins, panel, and the radio's
`<audio>`, playing. The page inside does not know it is framed: same window
of its own, same ids, same stylesheets, same scroll. Nothing in a page's
script changes to be openable this way, and that is the point of the frame
over the other shape, which is one document for the whole site. **The map
is the shell** in `README.md` carries the reasoning; the header of
`assets/shell.js` carries the mechanics. The surface is a dialog, the map
under it is `inert`, Back closes it, the address bar and the tab's title
follow the page inside.

**The one document for the whole site was considered and refused.** Six
page scripts and the map's own would each have had to learn to mount and
unmount into one document, with ids, listeners, timers and stylesheets that
today assume they own the page. The flashcards and the blog do stay in their
document between their own views — a deck, a post — and that is the right
size for it: one script, its own views. Do not propose the site-wide
version again without a reason this file does not already answer.

**What a framed page gets from the map, and the only two things:**

- **The radio.** `assets/radio.js` looks up first. In a frame on this site
  it builds no station list, no element and no switch; `mount()` lends the
  page's button to the parent's radio through `adopt()`, `language()` and
  `stop()` are the parent's, and the parent paints the button, lends it back
  bare before the page has its words, and lets go of it on the frame's
  `pagehide`. A page's language is a station the way the map's is; the
  map's comes back when the page closes. See *A PAGE INSIDE THE MAP* in
  that file.
- **The address and the title.** The map's history entry is one and the
  same across every step the page inside makes, so the shell never pushes
  twice: it rewrites that one entry's address after every document that
  arrives, every push the page makes (it wraps the frame's
  `history.pushState` and `replaceState`) and every `popstate` the page
  gets from Back or Forward. The tab's title follows the page's `<title>`
  through a MutationObserver.

Everything else a page does, it does for itself, in its own document.

**Three links go through the top of the tab**, and the shell handles them
from outside the page: a link to `/` (home is the map underneath, so the
surface closes), a link under `/api/` (Continue with Google is a redirect
Google refuses to frame), and a link to another origin. A page that walks
home by script — Sign out — is closed on arrival. A page needs nothing of
its own for any of this; do not add a `target` or a `window.top` to a page
to "help" the shell.

**What is not framed, on purpose:** the map itself, anything under `/api/`,
`/admin` and `admin.html`, files (a photo, a data file, a stylesheet), and
the two subdomains. `framed()` in `assets/shell.js` is the list; a new page
is framed by default and needs no line there.

**The headers allow exactly this.** `frame-ancestors 'self'` and
`X-Frame-Options: SAMEORIGIN` in `functions/_security.js` and in `_headers`,
held to each other by the validator. Not `'none'`, under which the frame is
blank; not same-site, under which a subdomain could frame the map. A
proposal to frame the subdomains is a proposal to loosen this, and is a
decision.

## The two subdomains

Splitwise and the flashcards are each a page of this repository served at
the root of a hostname of its own — `functions/_middleware.js`, the two
fenced blocks. To a browser each is a different site: its own
`localStorage` and `sessionStorage`, so no `ttb.lang` and no radio carried
over, which is why each carries a language switch of its own and why the
flashcards start silent there. The session cookie is scoped to the domain,
so an account is the same account on all three. **Why a subdomain** under
each feature says why that trade was made; **Flashcards** → *Three
languages, not ten* says what it cost.

The same page at `/flashcard` on the map's own host is what the rail
links, and it is framed; the subdomain is what gets sent and searched for.
Do not link the map to a subdomain address — that walk would leave the
document, and the music.

## Scripts are globals, not modules

No build step, so browser code is ES5 classic scripts, one IIFE each, and
what pages share is a global set by one file and loaded before the script
that uses it: `TTBTrack`, `TTBRadio`, `TTBShell`, `TTBDevice`, `TTBLanguage`,
`TTBCountry`, `TTBPass`, `TTBBasemap`, `TTBPins`, `TTBGoogleWords`. Document
order is execution order under `defer`, so the order of `<script>` tags at
the foot of a page is a dependency list, and each tag's comment says what
it is there before. A page that needs a shared thing loads the file; a
second copy of a shared thing in a page's own script is the thing the
globals exist to prevent. The `/site` skill → **Three things pages used to
copy are globals now** has the list that moved.

Functions are the other dialect, ESM on the Workers runtime, and share
through `functions/_shell.js` and `functions/api/_lib.js`. Two things are
written out twice because neither dialect can import the other — the pins
and the profile's networks — and the validator holds each pair together.

## Adding one of these

| Adding | What it touches, beyond its own files |
|---|---|
| a page | described first (`CLAUDE.md`); `PAGES` in `tools/stamp.mjs`; `PAGES` in `functions/api/_visitors.js`; `assets/analytics.js`, `track.js` and `back.js` in its markup; the boot block the `/site` skill names; a README section; its flow in `data/flows.json`. It is framed from the map with nothing more. If it carries the radio's button, `radio.js` before its own script and it works framed and whole. |
| a route under `/api/` | the `/api` skill's table and `_middleware.js`'s terms; never framed, never linked as a page |
| a shared script | one global, one IIFE, a header block saying what it is and why it is a global, loaded before its first user on every page that uses it; the `/site` skill's list of globals |
| a host | a fenced block in `_middleware.js` like the two there, a **Why a subdomain** paragraph in the README, and the knowledge that nothing walks to it from the map without leaving the document |
| a header | `functions/_security.js` and `_headers` together, the validator fails them apart; **The security headers** in the README |

## Where it goes wrong

- **Two radios.** A page framed over the map that builds its own `<audio>`
  plays beside the map's: the rejoin in `radio.js` reads the same
  `sessionStorage`. The look-up at the top of that file is what prevents it;
  a page that loads a different radio, or none, is outside it.
- **A second map inside the map.** A link to `/` followed inside the frame.
  The shell closes on it from outside; a page that navigates there by script
  is caught on arrival, a beat later. Prefer a link.
- **A header that frames nobody.** `frame-ancestors 'none'` is what every
  audit recommends, and it is what made the surface blank for an afternoon.
  The validator holds `_headers` to `_security.js`; it does not know what
  the value should be.
- **A page that assumes it is the top.** `window.top`, `parent`, a
  `target="_top"` on a link, a `beforeunload` — none of the pages do this
  today and none should start. The frame is the shell's business.
- **A proposal that is really the site-wide single document again.** Read
  **Pages are documents** above; if the reason is not answered there, add
  the reason to this file with the answer.
