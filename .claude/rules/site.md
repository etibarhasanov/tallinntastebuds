---
paths:
  - "assets/**"
  - "*.html"
  - "data/ui.json"
  - "data/lang/**"
  - "data/map.json"
  - "data/blog.json"
  - "data/privacy.json"
  - "clips/**"
  - "data/cuisines.json"
  - "data/radio.json"
  - "data/flows.json"
  - "tools/flows.mjs"
  - "flows/**"
  - "tools/lean.mjs"
  - "tools/stamp.mjs"
  - "tools/languages.mjs"
  - "tools/qrperf.mjs"
  - "tools/sitemap.mjs"
  - "tools/ogcard.mjs"
  - "tools/blogclips.mjs"
  - "sitemap.xml"
  - "robots.txt"
  - "_headers"
---

You are in the **site** process: something a visitor sees or presses. If the
`site` skill is not already loaded, load it now (`/site`, or
`.claude/skills/site/SKILL.md`) and follow it end to end, including its
pull-request section. Anything in `assets/` means `node tools/lean.mjs` if a
source in its `LEAN` list moved, then `node tools/stamp.mjs`, before the
validator, and a browser before the push. `data/lang/`, `data/map.json` and
every `assets/*.lean.*` file are generated: edit the source and run its tool,
never the copy.
