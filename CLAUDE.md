# Working on Tallinn Tastebuds

## Leave the code better than you found it

This is the main rule, and it outranks "make the change small".

Touching a file means reading what is around the thing you came to change. If
that code can be made cleaner, make it cleaner — in the same commit, as part of
the work. Do not step around a mess to get to your line and leave it exactly as
you found it.

In practice:

- **Four copies of the same three lines is a function.** If your change would
  add a fifth, write the function first and change one place instead of five.
  The chip handlers in `assets/app.js` are the worked example: every chip does
  the same thing, so `toggleChip()` and `clearChips()` do it once.
- **A comment that has stopped being true is a bug.** This codebase explains
  itself at length and that is only worth anything while the explanations are
  accurate. If your change makes a paragraph wrong, rewrite the paragraph.
  README included.
- **A name that describes what something used to be is worth changing.** When
  the list stopped being a filter, `LIST_FILTER` had to go, not stay as a
  constant with a misleading name.
- **Dead things go.** An unused i18n key, a CSS rule for an element nothing
  renders any more, a helper with no callers — delete them in the commit that
  orphaned them.
- **Refactor and behaviour change are the same commit here**, because the point
  is that the file is left in a better state than it was found in. Do not open
  a follow-up for the tidying.

Where a cleanup would grow past the change that prompted it — a rewrite of
something you only brushed against — say so rather than doing it silently or
pretending you did not see it.

## Before pushing

```bash
node tools/stamp.mjs      # if anything in assets/ changed
node tools/validate.mjs   # must pass; CI runs it
```

The stamper rewrites the `?v=` hash on every script and stylesheet reference in
the HTML pages, and the validator fails on a stale one.

## The shape of the thing

Static files, one Cloudflare Function, no build step and no npm install. The
map, the write-ups, the discounts and the stories are JSON in this repository;
the saves, the lists and the keeps are in D1 behind `/api/saves` and
`/api/lists`. The map renders completely with the database switched off, and
that is a property worth keeping.

`README.md` is the long-form documentation and is kept current with the code.
When you change behaviour, change the section that describes it.
