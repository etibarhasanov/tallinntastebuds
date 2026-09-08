/**
 * Tallinn Tastebuds — GET /api/profile?name=<name>.
 *
 * One person's public lists and the number of times they have been kept. Read
 * only: there is nothing on a profile that is not already a row somebody else
 * wrote, so there is no POST here and no column this route could set.
 *
 * /u/<name> serves the page with this answer already seeded into it, and this
 * is what the page asks when that did not happen: a deployment without the
 * Functions, or a shell handed back because the database was not reachable at
 * the moment the page was asked for. Same answer either way, which is what
 * keeps the two paths from drifting.
 *
 * Nothing here is cached, for the reason functions/api/lists.js gives about a
 * list: the number on it changes when somebody presses Keep, and a profile is
 * most likely to be opened by the person who has just been told about it.
 */

import { json, sessionUser, wrongDatabase } from './_lib.js';
import { readProfile } from './_profile.js';

export async function onRequestGet(context) {
  const { request, env } = context;

  /* The same three conditions the account and lists routes report, and
     reported the same way: a page that knows the feature is switched off here
     says so, instead of drawing a profile that would be empty for a reason it
     could not explain. */
  const ready = !!(env.DB && env.SAVE_SALT) && !(await wrongDatabase(env));
  if (!ready) return json({ ready: false, user: null, profile: null }, 200);

  const name = new URL(request.url).searchParams.get('name') || '';
  const user = await sessionUser(request, env);
  const profile = await readProfile(context, name, user);

  if (!profile) return json({ error: 'not-found' }, 404);

  return json({ ready: true, user: user ? user.username : null, profile: profile }, 200);
}
