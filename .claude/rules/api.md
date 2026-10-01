---
paths:
  - "functions/**"
  - "db/schema.sql"
  - "wrangler.toml"
  - "_routes.json"
  - "tools/functions-check.mjs"
  - ".claude/hooks/**"
  - ".claude/settings.json"
---

You are in the **api** process: a Cloudflare Function, the D1 schema, or the
bindings. If the `api` skill is not already loaded, load it now (`/api`, or
`.claude/skills/api/SKILL.md`) and follow it end to end, including its
pull-request section. The rows are other people's, nothing in CI applies the
schema, and production is the only database that is written to — **Production
only, for now** in `CLAUDE.md`. Preview is what `pages dev` happens to read,
and nothing more.

A write to either database is the owner's yes, asked for with the change
described — **The rules of a write** in that skill. `.claude/hooks/d1-write-gate.mjs`
is what makes the prompt appear; if you are editing the gate itself, run
`node .claude/hooks/d1-write-gate.mjs --check` and add the case you are
changing it for.
