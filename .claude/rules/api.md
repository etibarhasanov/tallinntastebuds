---
paths:
  - "functions/**"
  - "db/schema.sql"
  - "wrangler.toml"
  - "_routes.json"
---

You are in the **api** process: a Cloudflare Function, the D1 schema, or the
bindings. If the `api` skill is not already loaded, load it now (`/api`, or
`.claude/skills/api/SKILL.md`) and follow it end to end, including its
pull-request section. The rows are other people's, nothing in CI applies the
schema, and the preview database is the only one to test against.
