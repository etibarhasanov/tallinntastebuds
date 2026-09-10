---
paths:
  - "exports/**"
  - "db/google-venues.sql"
  - "db/google-lists.sql"
  - "tools/googlevenues.mjs"
  - "tools/googlelists.mjs"
  - "functions/api/venues.js"
---

You are in the **google-venues** process: the Google Places export, the SQL
generated from it, or the directory's vocabulary that the validator holds to
that export. If the `google-venues` skill is not already loaded, load it now
(`/google-venues`, or `.claude/skills/google-venues/SKILL.md`) and follow it
end to end, including its pull-request section. `db/google-venues.sql` and
`db/google-lists.sql` are generated; never edit either by hand.
