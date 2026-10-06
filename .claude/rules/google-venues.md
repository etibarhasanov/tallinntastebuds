---
paths:
  - "exports/**"
  - "db/google-venues.sql"
  - "db/google-lists.sql"
  - "db/city-venues.sql"
  - "data/city.json"
  - "tools/googlevenues.mjs"
  - "tools/googlelists.mjs"
  - "tools/city.mjs"
  - "tools/cityvenues.mjs"
  - "functions/api/venues.js"
---

You are in the **google-venues** process: the Google Places export, the SQL
and the city's dots generated from it, or the directory's vocabulary that the
validator holds to that export. If the `google-venues` skill is not already
loaded, load it now (`/google-venues`, or
`.claude/skills/google-venues/SKILL.md`) and follow it end to end, including
its pull-request section. `db/google-venues.sql`, `db/google-lists.sql`,
`db/city-venues.sql` and `data/city.json` are generated; never edit any of
them by hand.
