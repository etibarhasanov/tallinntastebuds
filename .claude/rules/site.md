---
paths:
  - "assets/**"
  - "*.html"
  - "data/ui.json"
  - "data/cuisines.json"
  - "data/radio.json"
  - "tools/stamp.mjs"
  - "tools/qrperf.mjs"
  - "_headers"
---

You are in the **site** process: something a visitor sees or presses. If the
`site` skill is not already loaded, load it now (`/site`, or
`.claude/skills/site/SKILL.md`) and follow it end to end, including its
pull-request section. Anything in `assets/` means `node tools/stamp.mjs`
before the validator, and a browser before the push.
