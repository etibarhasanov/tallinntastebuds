/**
 * Tallinn Tastebuds — who the owner is, to the server.
 *
 * Everything under /admin/ and /api/admin/ is the owner's and nobody else's:
 * /admin/stats, which is how the site is used — what gets opened, what gets
 * pressed, how many accounts there are — /admin/google, which hands over the
 * whole of the Google export, eleven hundred rows with every phone number and
 * week of opening hours in one answer, and the routes they and the admin page
 * read. The first two were public for a while, at /stats and /google, on the
 * argument that nothing linked to them. An address nobody links to is still an
 * address, and both answers are cheap to ask for and expensive to have handed
 * out, so they moved under the two prefixes and functions/_middleware.js
 * locks both with what is below.
 *
 * WHO COUNTS AS THE OWNER
 *
 * A signed-in account whose id is named in the ADMINS variable in
 * wrangler.toml — a comma-separated list of `users.id`, one per environment
 * block, because the two databases hold two different sets of accounts.
 *
 * The id and not the username, on purpose. A username can be changed, the old
 * one goes into a thirty-day hold — see HOLD_DAYS in ./_account.js — and after
 * that anybody can sign up as it. A gate keyed on a name would hand the
 * statistics to whoever claimed it next. An id is a UUID minted with the row
 * and never reused, so a rename carries the gate with it and nothing else can.
 *
 * It is a variable and not a secret because it is not one: knowing the id
 * gets nobody anything, since the only way to *be* that account is the session
 * cookie sessionUser() in ./_lib.js reads. Written in wrangler.toml, it is in
 * the review of whoever changes it.
 *
 * /admin.html is not this. That page holds a GitHub token sealed under a
 * passphrase and never talks to the server at all — see **The admin page** in
 * README.md — so there was no admin identity here to reuse, and the site's own
 * accounts are the one the server can already check.
 *
 * FAILS CLOSED
 *
 * No ADMINS, an empty one, no database, the other environment's database, or
 * a session that cannot be read: all of them answer "not the owner". The cost
 * of a mistake here is the owner seeing a 404 on their own page, which a line
 * in wrangler.toml fixes; the cost the other way is the statistics handed out.
 */

import { sessionUser, wrongDatabase } from './_lib.js';

/* The ids ADMINS names, trimmed, empties dropped. A users.id is a UUID, and
   anything that is not shaped like one is ignored rather than trusted, so a
   stray word pasted into the variable cannot match anything. */
const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function adminIds(env) {
  const out = new Set();
  for (const part of String((env && env.ADMINS) || '').split(',')) {
    const id = part.trim().toLowerCase();
    if (USER_ID.test(id)) out.add(id);
  }
  return out;
}

/* The signed-in owner, or null. Cheap when it is going to say no: without an
   ADMINS entry it answers before it touches the database. */
export async function adminUser(request, env) {
  const ids = adminIds(env);
  if (!ids.size || !env.DB) return null;
  try {
    if (await wrongDatabase(env)) return null;
    const user = await sessionUser(request, env);
    if (!user || !ids.has(String(user.id).toLowerCase())) return null;
    return user;
  } catch (e) {
    return null;
  }
}
