/**
 * Tallinn Tastebuds — /api/admin/github/…, the admin page's road to the repository.
 *
 *   ANY /api/admin/github/<path>?<query>
 *     → https://api.github.com/repos/etibarhasanov/tallinntastebuds/<path>?<query>
 *
 * The admin page changes the site by writing to this repository — a story, a
 * discount, a place — and it used to do that with a GitHub token pasted into
 * each device and sealed there under a passphrase. Every new phone was a token
 * to make on GitHub, a passphrase to choose and a vault to unlock, and the
 * token died every ninety days. The owner already signs in on the site with an
 * account, on every device, so that sign-in is now the whole of the door: the
 * token lives here, as the GITHUB_TOKEN secret, and the page asks through this
 * route instead of asking GitHub.
 *
 * WHO MAY ASK
 *
 * The owner, and nobody else: everything under /api/admin/ is answered by the
 * lock in functions/_middleware.js first — adminUser() in ../../_admin.js, a 403
 * to anybody else — so nothing reaches this file that is not the owner's. It
 * adds one check of its own on anything that writes: the request has to come
 * from a page on this same origin. The session cookie is SameSite=Lax, which
 * already keeps it off a cross-site POST, but it is scoped to the parent domain
 * so the flashcards share it, and a write to the repository is the one thing on
 * the site worth a second lock.
 *
 * WHAT IT REACHES
 *
 * This one repository, and only the parts of the API the page uses: the
 * repository itself (to say which branch is live and whether the token can
 * write), `contents/` (stories, deals, places, photographs), `git/` (the
 * branch and the one commit a place is written as) and, to read only,
 * `actions/runs` (whether the branch has landed). Anything else is a 404 here
 * rather than a request GitHub gets to answer.
 *
 * WHAT A FAILURE LOOKS LIKE
 *
 * No GITHUB_TOKEN set: 503 { error: "no-token" }, and the page says the
 * secret is missing rather than offering forms that cannot save. GitHub's own
 * answers — a 401 for an expired token, a 409 for a stale sha — are passed
 * through as GitHub gave them, status and body, so the page reads exactly what
 * it read when it called GitHub itself.
 *
 * THE TOKEN
 *
 * A fine-grained personal access token scoped to this one repository, with
 * Contents read and write and Actions read, set as GITHUB_TOKEN in the Pages
 * project's production secrets — **The admin page** in README.md says how. It
 * is never sent to the browser.
 */

import { json } from '../../_lib.js';

const REPO = 'etibarhasanov/tallinntastebuds';

/* The first segment of the path, and which methods each may use. '' is the
   repository itself. */
const ALLOWED = {
  '': ['GET'],
  contents: ['GET', 'PUT'],
  git: ['GET', 'POST', 'PATCH'],
  actions: ['GET']
};

export async function onRequest(context) {
  const { request, env, params } = context;
  const token = String(env.GITHUB_TOKEN || '').trim();
  if (!token) return json({ error: 'no-token' }, 503);

  const parts = [].concat(params.path || []);
  const allowed = ALLOWED[parts[0] || ''];
  if (!allowed || !allowed.includes(request.method)) return json({ error: 'not-found' }, 404);
  /* actions/ is for reading runs, not for re-running or cancelling them. */
  if (parts[0] === 'actions' && parts[1] !== 'runs') return json({ error: 'not-found' }, 404);

  if (request.method !== 'GET') {
    const origin = request.headers.get('Origin');
    if (origin !== new URL(request.url).origin) return json({ error: 'origin' }, 403);
  }

  const url = new URL(request.url);
  const target = 'https://api.github.com/repos/' + REPO +
    (parts.length ? '/' + parts.map(encodeURIComponent).join('/') : '') + url.search;

  const res = await fetch(target, {
    method: request.method,
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'tallinntastebuds-admin',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    body: request.method === 'GET' ? undefined : await request.arrayBuffer()
  });

  const out = new Response(res.body, { status: res.status });
  out.headers.set('content-type', res.headers.get('content-type') || 'application/json; charset=utf-8');
  out.headers.set('cache-control', 'no-store');
  /* When the token runs out, so the page can say so before it does. */
  const expires = res.headers.get('github-authentication-token-expiration');
  if (expires) out.headers.set('x-token-expires', expires);
  return out;
}
