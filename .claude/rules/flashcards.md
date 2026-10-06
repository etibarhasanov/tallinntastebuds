---
paths:
  - "data/decks.json"
  - "data/decks/**"
  - "flashcard.html"
  - "assets/flashcard.js"
  - "assets/flashcard-first.js"
  - "assets/flashcard.css"
  - "assets/logo/og-flashcard.html"
  - "assets/logo/og-flashcard.png"
  - "functions/flashcard.js"
  - "functions/api/flashcard.js"
  - "functions/api/_decks.js"
  - "functions/api/say.js"
  - "tools/decks.mjs"
  - "tools/ogcard.mjs"
---

You are in the **flashcards** process: a deck, a lesson or a song in
`data/decks.json`, the page that turns them over, or the routes that answer
and speak them. If the `flashcards` skill is not already loaded, load it now
(`/flashcards`, or `.claude/skills/flashcards/SKILL.md`) and follow it end to
end, including its pull-request section. The `/site` and `/api` skills apply
as well, since the page is a page and the routes are Functions. The data file
is content in three languages, not interface in ten; `node tools/validate.mjs`
holds every deck, card, lesson and song in it to a shape the skill spells
out, and `data/decks/` is generated from it by `node tools/decks.mjs` — never
edited by hand. A conversation under `talks` is the `/conversation` skill as
well, which starts from a course's sheet and ends at the same pull request.
