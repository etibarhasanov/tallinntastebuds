/* Tallinn Tastebuds — the editor's back end.
 *
 * A single Cloudflare Pages Function, which means it deploys with the site and
 * there is still nothing to build. It does exactly three things:
 *
 *   POST /api/login   swap the password for a signed cookie
 *   GET  /api/state   hand the editor the current data, straight from GitHub
 *   POST /api/save    write it back as one commit, photos included
 *
 * The site itself stays what it always was: static files a browser fetches.
 * Nothing here runs for a visitor looking at the map — only for /admin/.
 *
 * Everything is spoken to GitHub rather than to a database, so the repo stays
 * the single source of truth: every edit is a commit, with a diff and an
 * author, and `git revert` is the undo button. Cloudflare Pages redeploys
 * itself on the push, which is what puts the change on the map a minute later.
 *
 * Four bindings, set in the Pages project (Settings → Environment variables):
 *
 *   ADMIN_PASSWORD   secret. The only thing standing in front of the editor.
 *   GITHUB_TOKEN     secret. Fine-grained PAT, Contents: read and write, this
 *                    repository only.
 *   GITHUB_REPO      plain text, "owner/name". Optional; defaults below.
 *   GITHUB_BRANCH    plain text, the branch Pages deploys. Optional.
 *   SESSION_SECRET   secret, optional. Signs the cookie; falls back to the
 *                    password, which means changing the password logs
 *                    everyone out — usually what you want.
 */

import { validateAll, serialise } from '../../admin/place-rules.js';

const DEFAULT_REPO = 'etibarhasanov/tallinntastebuds';
const DEFAULT_BRANCH = 'claude/tallinn-tastebuds-map-nzoqx0';

const COOKIE = 'ttb_admin';
const SESSION_DAYS = 30;

/* A phone photo resized in the browser lands around 120 KB. These ceilings are
   there to catch a full-resolution original slipping through, not to be tight:
   the repo keeps every byte of every photo for good. */
const MAX_PHOTOS_PER_SAVE = 20;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;

/* ------------------------------------------------------------------ replies */

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers
    }
  });

const oops = (status, message, extra = {}) => json({ error: message, ...extra }, status);

/* ------------------------------------------------------------------ session
   A signed cookie rather than a stored session: there is one user, and a
   Pages Function has no memory between requests without adding a KV namespace
   for it. The payload carries nothing but an expiry, so the cookie is useless
   for anything except proving the password was typed. */

const encoder = new TextEncoder();

const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function signingKey(env) {
  const secret = env.SESSION_SECRET || env.ADMIN_PASSWORD || '';
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

async function mint(env) {
  const payload = b64url(encoder.encode(JSON.stringify({ exp: Date.now() + SESSION_DAYS * 864e5 })));
  const signature = await crypto.subtle.sign('HMAC', await signingKey(env), encoder.encode(payload));
  return `${payload}.${b64url(signature)}`;
}

async function valid(token, env) {
  if (typeof token !== 'string' || !token.includes('.')) return false;
  const [payload, signature] = token.split('.');
  const expected = b64url(await crypto.subtle.sign('HMAC', await signingKey(env), encoder.encode(payload)));
  if (!same(signature, expected)) return false;
  try {
    const { exp } = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof exp === 'number' && exp > Date.now();
  } catch {
    return false;
  }
}

/* Comparison that takes the same time whichever character differs, so the
   password cannot be guessed one letter at a time by watching the clock. */
function same(a, b) {
  const left = encoder.encode(String(a));
  const right = encoder.encode(String(b));
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    diff |= (left[i] || 0) ^ (right[i] || 0);
  }
  return diff === 0;
}

function cookieValue(request, name) {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

const setCookie = (token) =>
  `${COOKIE}=${token}; Path=/; Max-Age=${SESSION_DAYS * 86400}; HttpOnly; Secure; SameSite=Strict`;
const clearCookie = () => `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;

/* ------------------------------------------------------------------- GitHub */

function repoOf(env) {
  return {
    repo: env.GITHUB_REPO || DEFAULT_REPO,
    branch: env.GITHUB_BRANCH || DEFAULT_BRANCH,
    token: env.GITHUB_TOKEN
  };
}

async function gh(env, path, init = {}) {
  const { repo, token } = repoOf(env);
  const response = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...init,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'user-agent': 'tallinntastebuds-admin',
      'x-github-api-version': '2022-11-28',
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers || {})
    }
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new HttpError(response.status === 404 ? 502 : 502,
      `GitHub said ${response.status} for ${path}`,
      { detail: detail.slice(0, 400) });
  }
  return response;
}

class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const ghJSON = async (env, path, init) => (await gh(env, path, init)).json();

async function headCommit(env) {
  const { branch } = repoOf(env);
  const ref = await ghJSON(env, `/git/ref/heads/${encodeURIComponent(branch)}`);
  const commit = await ghJSON(env, `/git/commits/${ref.object.sha}`);
  return { sha: ref.object.sha, tree: commit.tree.sha };
}

async function fileAt(env, sha, path) {
  const response = await gh(env, `/contents/${path}?ref=${sha}`, { headers: { accept: 'application/vnd.github.raw' } });
  return response.text();
}

/* ------------------------------------------------------------------- routes */

export async function onRequest(context) {
  const { request, env, params } = context;
  const path = Array.isArray(params.path) ? params.path.join('/') : String(params.path || '');

  try {
    if (!env.ADMIN_PASSWORD || !env.GITHUB_TOKEN) {
      return oops(503, 'The editor is not configured yet: ADMIN_PASSWORD and GITHUB_TOKEN are missing from this Pages project.');
    }

    if (path === 'login' && request.method === 'POST') return login(request, env);
    if (path === 'logout' && request.method === 'POST') return json({ ok: true }, 200, { 'set-cookie': clearCookie() });

    /* Everything past this point needs the cookie. */
    if (!(await valid(cookieValue(request, COOKIE), env))) return oops(401, 'Not signed in');

    if (path === 'state' && request.method === 'GET') return state(env);
    if (path === 'save' && request.method === 'POST') return save(request, env);

    return oops(404, 'No such endpoint');
  } catch (err) {
    if (err instanceof HttpError) return oops(err.status, err.message, err.extra);
    return oops(500, err && err.message ? err.message : 'Something went wrong');
  }
}

async function login(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return oops(400, 'Expected JSON');
  }

  /* A deliberate second of thinking time. There is no request counter to lean
     on here, so the defence against guessing is that guessing is slow. */
  await new Promise((resolve) => setTimeout(resolve, 1000));

  if (!same(body && body.password, env.ADMIN_PASSWORD)) return oops(401, 'Wrong password');
  return json({ ok: true }, 200, { 'set-cookie': setCookie(await mint(env)) });
}

async function state(env) {
  const { repo, branch } = repoOf(env);
  const head = await headCommit(env);

  const [restaurants, taxonomy, ui] = await Promise.all([
    fileAt(env, head.sha, 'data/restaurants.json'),
    fileAt(env, head.sha, 'data/taxonomy.json'),
    fileAt(env, head.sha, 'data/ui.json')
  ]);

  const tree = await ghJSON(env, `/git/trees/${head.tree}?recursive=1`);
  const photosById = {};
  for (const entry of tree.tree || []) {
    const found = entry.type === 'blob' && /^photos\/([^/]+)\/([^/]+)$/.exec(entry.path);
    if (!found) continue;
    (photosById[found[1]] = photosById[found[1]] || []).push(found[2]);
  }
  for (const id of Object.keys(photosById)) photosById[id].sort();

  return json({
    repo,
    branch,
    sha: head.sha,
    truncated: Boolean(tree.truncated),
    places: JSON.parse(restaurants),
    types: JSON.parse(taxonomy).types || [],
    languages: Object.keys(JSON.parse(ui)),
    photosById
  });
}

async function save(request, env) {
  const { branch } = repoOf(env);

  let body;
  try {
    body = await request.json();
  } catch {
    return oops(400, 'Expected JSON');
  }

  const places = body.places;
  const uploads = Array.isArray(body.uploads) ? body.uploads : [];
  const deletions = Array.isArray(body.deletions) ? body.deletions : [];
  const message = typeof body.message === 'string' && body.message.trim()
    ? body.message.trim().slice(0, 500)
    : 'Update the map from the editor';

  if (!Array.isArray(places)) return oops(400, 'places must be an array');
  if (uploads.length > MAX_PHOTOS_PER_SAVE) return oops(413, `That is more than ${MAX_PHOTOS_PER_SAVE} photos in one save.`);

  let total = 0;
  for (const upload of uploads) {
    if (!upload || typeof upload.path !== 'string' || typeof upload.base64 !== 'string') {
      return oops(400, 'Every upload needs a path and base64 content');
    }
    if (!/^photos\/[a-z0-9]+(?:-[a-z0-9]+)*\/[A-Za-z0-9._-]+\.(webp|jpg|jpeg|png|avif)$/i.test(upload.path)) {
      return oops(400, `"${upload.path}" is not a photos/<id>/<file> path`);
    }
    const bytes = Math.floor(upload.base64.length * 3 / 4);
    if (bytes > MAX_PHOTO_BYTES) return oops(413, `"${upload.path}" is ${Math.round(bytes / 1024)} KB — resize it below ${MAX_PHOTO_BYTES / 1024} KB first.`);
    total += bytes;
  }
  if (total > MAX_TOTAL_BYTES) return oops(413, 'That is too much in one save. Do it in two.');

  for (const path of deletions) {
    if (!/^photos\/[a-z0-9]+(?:-[a-z0-9]+)*\/[A-Za-z0-9._-]+$/.test(String(path))) {
      return oops(400, `"${path}" is not a photo this editor may delete`);
    }
  }

  const head = await headCommit(env);
  if (body.baseSha && body.baseSha !== head.sha) {
    return oops(409, 'The repository moved on while you were editing. Reload before saving.', { sha: head.sha });
  }

  /* Validate against the taxonomy and languages as they are *now*, not as the
     browser saw them, and against the photos that will exist after this
     commit rather than before it. */
  const [taxonomy, ui, current] = await Promise.all([
    fileAt(env, head.sha, 'data/taxonomy.json'),
    fileAt(env, head.sha, 'data/ui.json'),
    fileAt(env, head.sha, 'data/restaurants.json')
  ]);

  const tree = await ghJSON(env, `/git/trees/${head.tree}?recursive=1`);
  const photosById = {};
  for (const entry of tree.tree || []) {
    const found = entry.type === 'blob' && /^photos\/([^/]+)\/([^/]+)$/.exec(entry.path);
    if (found) (photosById[found[1]] = photosById[found[1]] || []).push(found[2]);
  }
  for (const upload of uploads) {
    const [, id, file] = upload.path.split('/');
    const list = photosById[id] = photosById[id] || [];
    if (!list.includes(file)) list.push(file);
  }
  for (const path of deletions) {
    const [, id, file] = String(path).split('/');
    if (photosById[id]) photosById[id] = photosById[id].filter((name) => name !== file);
  }

  const languages = Object.keys(JSON.parse(ui));
  const check = validateAll(places, {
    typeIds: (JSON.parse(taxonomy).types || []).map((t) => t.id),
    languages,
    photosById
  });
  if (check.errors.length) return oops(422, 'The data is not valid', { errors: check.errors });

  const text = serialise(places, languages);
  const dataChanged = text !== current;
  if (!dataChanged && uploads.length === 0 && deletions.length === 0) {
    return json({ ok: true, unchanged: true, sha: head.sha, warnings: check.warnings });
  }

  /* One commit for the lot: the data file and every photo land together, so
     the map is never live with a place pointing at a photo that has not been
     pushed yet. The Contents API cannot do that; the Git tree API can. */
  const entries = [];

  if (dataChanged) {
    const blob = await ghJSON(env, '/git/blobs', {
      method: 'POST',
      body: JSON.stringify({ content: text, encoding: 'utf-8' })
    });
    entries.push({ path: 'data/restaurants.json', mode: '100644', type: 'blob', sha: blob.sha });
  }

  for (const upload of uploads) {
    const blob = await ghJSON(env, '/git/blobs', {
      method: 'POST',
      body: JSON.stringify({ content: upload.base64, encoding: 'base64' })
    });
    entries.push({ path: upload.path, mode: '100644', type: 'blob', sha: blob.sha });
  }

  for (const path of deletions) {
    entries.push({ path: String(path), mode: '100644', type: 'blob', sha: null });
  }

  const newTree = await ghJSON(env, '/git/trees', {
    method: 'POST',
    body: JSON.stringify({ base_tree: head.tree, tree: entries })
  });

  const commit = await ghJSON(env, '/git/commits', {
    method: 'POST',
    body: JSON.stringify({ message, tree: newTree.sha, parents: [head.sha] })
  });

  /* No force: if something pushed in the seconds since headCommit(), GitHub
     refuses rather than throwing that push away. */
  await ghJSON(env, `/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha, force: false })
  });

  return json({
    ok: true,
    sha: commit.sha,
    branch,
    photos: uploads.length,
    removed: deletions.length,
    warnings: check.warnings
  });
}
